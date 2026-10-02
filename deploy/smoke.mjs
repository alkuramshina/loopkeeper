import assert from 'node:assert/strict';
import https from 'node:https';
import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire('/app/package.json');
const sharp = require('sharp');

// Controlled CI CA only. Real-domain smoke uses the normal TLS trust store.
const origin = process.env.SMOKE_ORIGIN ?? 'https://proxy';
const internalTLS = process.env.SMOKE_INTERNAL_TLS === 'true';
const host =
  process.env.SMOKE_HOST ??
  (internalTLS ? 'localhost' : new URL(origin).hostname);
const statePath = '/tmp/smoke-state.json';
async function request(
  path,
  { method = 'GET', user, data, body, headers = {} } = {},
) {
  const payload =
    body ?? (data ? Buffer.from(JSON.stringify(data)) : undefined);
  return new Promise((resolve, reject) => {
    const req = https.request(
      origin + path,
      {
        method,
        rejectUnauthorized: !internalTLS,
        servername: host,
        headers: {
          Host: host,
          ...(data ? { 'Content-Type': 'application/json' } : {}),
          ...(payload ? { 'Content-Length': payload.length } : {}),
          ...(user
            ? {
                Authorization: `Bearer ${user.token}`,
                Cookie: user.cookie ?? '',
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const bytes = Buffer.concat(chunks);
          const cookie = res.headers['set-cookie']?.[0];
          if (user && cookie) user.cookie = cookie.split(';')[0];
          resolve({
            status: res.statusCode,
            headers: res.headers,
            bytes,
            json: () => JSON.parse(bytes.toString()),
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(65_000, () =>
      req.destroy(new Error('Smoke request timed out')),
    );
    if (payload) req.write(payload);
    req.end();
  });
}
async function ok(path, options, status = 200) {
  const response = await request('/api' + path, options);
  assert.equal(response.status, status, `${path}: unexpected status`);
  return response;
}

if (process.argv.includes('--api-down')) {
  const response = await ok('/health/ready', undefined, 503);
  assert.match(response.headers['cache-control'], /no-store/);
  console.log('Stopped API returns explicit maintenance 503 through proxy.');
} else if (process.argv.includes('--ready-down')) {
  await ok('/health/ready', undefined, 503);
  await ok('/health/live');
  console.log('Readiness failure and liveness verified.');
} else if (process.argv.includes('--persisted')) {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  await ok('/health/ready');
  assert.equal(
    (await ok(`/elements/${state.elementId}`, { user: state.owner })).json()
      .title,
    'Production smoke material',
  );
  assert.ok(
    (
      await ok(`/campaigns/${state.campaignId}/investigation-board`, {
        user: state.owner,
      })
    ).json().cards.length,
  );
  assert.ok((await ok(state.mediaUrl, { user: state.owner })).bytes.length);
  console.log('Campaign, material, board and media survived recreation.');
} else {
  const redirect = await new Promise((resolve, reject) => {
    http
      .get(
        origin.replace('https:', 'http:') + '/api/health/ready',
        { headers: { Host: host } },
        (response) => {
          response.resume();
          response.on('end', () =>
            resolve({
              status: response.statusCode,
              location: response.headers.location,
            }),
          );
        },
      )
      .on('error', reject);
  });
  assert.equal(redirect.status, 308);
  assert.equal(redirect.location, `https://${host}/api/health/ready`);
  await ok('/health/ready');
  for (const path of [
    '/api',
    '/api/not-a-route',
    '/api/docs',
    '/api/docs-json',
    '/api/api-json',
  ]) {
    const response = await request(path);
    assert.equal(response.status, 404);
    assert.ok(response.headers['content-type']?.includes('application/json'));
  }
  for (const path of [
    '/assets/missing.js',
    '/missing.css',
    '/favicon-missing.ico',
  ])
    assert.equal((await request(path)).status, 404);
  const deep = await request('/campaigns/unknown/board');
  assert.equal(deep.status, 200);
  assert.ok(deep.headers['content-type']?.includes('text/html'));

  const users = [];
  for (const name of ['Owner', 'Player', 'Viewer', 'Outsider']) {
    const user = {
      email: `${name.toLowerCase()}-${Date.now()}@smoke.invalid`,
      password: 'Production-smoke-password-2026',
    };
    const response = await ok(
      '/auth/register',
      {
        method: 'POST',
        user,
        data: { name, email: user.email, password: user.password },
      },
      201,
    );
    user.token = response.json().accessToken;
    const cookie = response.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.match(cookie, /Path=\//i);
    assert.doesNotMatch(cookie, /Domain=/i);
    users.push(user);
  }
  const [owner, player, viewer, outsider] = users;
  const login = await ok('/auth/login', {
    method: 'POST',
    user: owner,
    data: { email: owner.email, password: owner.password },
  });
  owner.token = login.json().accessToken;
  const priorCookie = owner.cookie;
  owner.token = (
    await ok('/auth/refresh', { method: 'POST', user: owner })
  ).json().accessToken;
  assert.notEqual(owner.cookie, priorCookie);
  const campaignId = (
    await ok(
      '/campaigns',
      {
        method: 'POST',
        user: owner,
        data: {
          title: 'Production smoke campaign',
          system: 'TALES_FROM_THE_LOOP',
        },
      },
      201,
    )
  ).json().campaignId;
  for (const [user, role] of [
    [player, 'PLAYER'],
    [viewer, 'VIEWER'],
  ]) {
    const invitation = (
      await ok(
        `/campaigns/${campaignId}/invitations`,
        {
          method: 'POST',
          user: owner,
          data: { role },
        },
        201,
      )
    ).json();
    await ok(
      `/invitations/${invitation.token}/accept`,
      { method: 'POST', user },
      201,
    );
  }
  const elementId = (
    await ok(
      `/campaigns/${campaignId}/elements`,
      {
        method: 'POST',
        user: owner,
        data: {
          type: 'OTHER',
          title: 'Production smoke material',
          access: 'SHARED',
        },
      },
      201,
    )
  ).json().elementId;
  // A near-limit 10 MiB location-map multipart crosses the proxy without buffering/cutting it.
  const locationId = (
    await ok(
      `/campaigns/${campaignId}/elements`,
      {
        method: 'POST',
        user: owner,
        data: {
          type: 'LOCATION',
          title: 'Production smoke location',
          access: 'SHARED',
        },
      },
      201,
    )
  ).json().elementId;
  const png = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: '#ad7843' },
  })
    .png()
    .toBuffer();
  const upload = async (path, nearLimit = false) => {
    const boundary = 'loopkeeper-smoke-boundary';
    const file = nearLimit
      ? Buffer.concat([png, Buffer.alloc(10 * 1024 * 1024 - png.length)])
      : png;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return ok(
      path,
      {
        method: 'POST',
        user: owner,
        body,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
      },
      201,
    );
  };
  await upload(`/elements/${elementId}/cover`);
  await upload(`/elements/${locationId}/map`, true);
  await upload(`/campaigns/${campaignId}/cover`);
  const element = (await ok(`/elements/${elementId}`, { user: owner })).json();
  const mediaUrl = element.coverUrl;
  assert.ok(mediaUrl?.startsWith('/media/'));
  for (const user of [owner, player, viewer]) {
    await ok(`/elements/${elementId}`, { user });
    const media = await ok(mediaUrl, { user });
    assert.ok(media.bytes.length);
    assert.match(media.headers['cache-control'], /private|no-store/);
  }
  for (const path of [
    `/elements/${elementId}`,
    mediaUrl,
    `/campaigns/${campaignId}/investigation-board`,
  ])
    await ok(path, { user: outsider }, 404);
  // IDs belonging to another campaign remain inaccessible even to an owner elsewhere.
  await ok(
    '/campaigns',
    {
      method: 'POST',
      user: outsider,
      data: { title: 'Other tenant', system: 'TALES_FROM_THE_LOOP' },
    },
    201,
  );
  await ok(`/elements/${elementId}`, { user: outsider }, 404);
  await ok(mediaUrl, { user: outsider }, 404);
  await ok(
    `/elements/${elementId}/access`,
    { method: 'PATCH', user: viewer, data: { access: 'MASTER_ONLY' } },
    404,
  );
  await ok(`/elements/${elementId}/access`, {
    method: 'PATCH',
    user: owner,
    data: { access: 'MASTER_ONLY' },
  });
  for (const user of [player, viewer]) {
    await ok(`/elements/${elementId}`, { user }, 404);
    await ok(mediaUrl, { user }, 404);
  }
  await ok(
    `/campaigns/${campaignId}/cards`,
    {
      method: 'POST',
      user: player,
      data: { cardKind: 'FREE', title: 'Production board card', tags: [] },
    },
    201,
  );
  await ok(
    `/campaigns/${campaignId}/cards`,
    {
      method: 'POST',
      user: viewer,
      data: { cardKind: 'FREE', title: 'Forbidden card', tags: [] },
    },
    404,
  );
  await ok('/auth/logout', { method: 'POST', user: player }, 204);
  assert.equal(player.cookie, 'refresh_token=');
  await ok('/auth/refresh', { method: 'POST', user: player }, 401);
  writeFileSync(
    statePath,
    JSON.stringify({ owner, campaignId, elementId, mediaUrl }),
    { mode: 0o600 },
  );
  console.log(
    'Production routing, cookies, roles, board and media smoke passed.',
  );
}
