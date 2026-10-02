import assert from 'node:assert/strict';
import https from 'node:https';
async function login(spoof) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      'https://proxy/api/auth/login',
      {
        method: 'POST',
        rejectUnauthorized: false,
        servername: 'localhost',
        headers: {
          Host: 'localhost',
          'Content-Type': 'application/json',
          'X-Forwarded-For': `198.51.100.${spoof}`,
          'X-Forwarded-Host': 'evil.invalid',
          'X-Forwarded-Proto': 'http',
        },
      },
      (response) => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      },
    );
    request.on('error', reject);
    request.end(
      JSON.stringify({
        email: 'unknown@smoke.invalid',
        password: 'incorrect-password',
      }),
    );
  });
}
for (let attempt = 0; attempt < 5; attempt++)
  assert.equal(await login(attempt), 401);
assert.equal(
  await login(99),
  429,
  'Spoofed forwarding header bypassed the limit',
);
console.log('Independent client IP and forwarding spoof protection passed.');
