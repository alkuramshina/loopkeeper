import { APIRequestContext, Browser, expect, Page } from '@playwright/test';
import { Client } from 'pg';

// Test data is prepared through the real API (via the Vite proxy) instead of
// clicking through the UI, so each spec only exercises the flow it is about.

export const PASSWORD = 'browser-test-password';

export type TestUser = {
  userId: string;
  email: string;
  name: string;
  password: string;
  headers: { Authorization: string };
};

export type Role = 'PLAYER' | 'VIEWER';

let sequence = 0;

export function uniqueEmail(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}@browser.test`;
}

async function json<T>(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
): Promise<T> {
  expect(
    response.ok(),
    `${response.url()} → ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  return (await response.json()) as T;
}

export async function registerUser(
  request: APIRequestContext,
  name: string,
): Promise<TestUser> {
  // ASCII only: the browser's type="email" rejects a non-ASCII local part.
  const email = uniqueEmail('user');
  const auth = await json<{ accessToken: string }>(
    await request.post('/api/auth/register', {
      data: { email, name, password: PASSWORD },
    }),
  );
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const profile = await json<{ userId: string }>(
    await request.get('/api/auth/me', { headers }),
  );
  return { userId: profile.userId, email, name, password: PASSWORD, headers };
}

/** Starts a browser session: the HttpOnly refresh cookie lands in the page context. */
export async function signInAs(page: Page, user: TestUser): Promise<void> {
  await json(
    await page.request.post('/api/auth/login', {
      data: { email: user.email, password: user.password },
    }),
  );
}

export async function createCampaign(
  request: APIRequestContext,
  owner: TestUser,
  title = 'Тайна у озера',
): Promise<string> {
  const campaign = await json<{ campaignId: string }>(
    await request.post('/api/campaigns', {
      headers: owner.headers,
      data: {
        title,
        description: 'Кампания для браузерных тестов',
        system: 'TALES_FROM_THE_LOOP',
      },
    }),
  );
  return campaign.campaignId;
}

export async function createInvitation(
  request: APIRequestContext,
  owner: TestUser,
  campaignId: string,
  role: Role,
): Promise<string> {
  const invitation = await json<{ token: string }>(
    await request.post(`/api/campaigns/${campaignId}/invitations`, {
      headers: owner.headers,
      data: { role },
    }),
  );
  return invitation.token;
}

export async function addMember(
  request: APIRequestContext,
  owner: TestUser,
  campaignId: string,
  member: TestUser,
  role: Role,
): Promise<void> {
  const token = await createInvitation(request, owner, campaignId, role);
  await json(
    await request.post(`/api/invitations/${token}/accept`, {
      headers: member.headers,
    }),
  );
}

export type CampaignWithRoles = {
  campaignId: string;
  owner: TestUser;
  player: TestUser;
  viewer: TestUser;
};

export async function createCampaignWithRoles(
  request: APIRequestContext,
): Promise<CampaignWithRoles> {
  const owner = await registerUser(request, 'Мастер');
  const player = await registerUser(request, 'Игрок');
  const viewer = await registerUser(request, 'Наблюдатель');
  const campaignId = await createCampaign(request, owner);
  await addMember(request, owner, campaignId, player, 'PLAYER');
  await addMember(request, owner, campaignId, viewer, 'VIEWER');
  return { campaignId, owner, player, viewer };
}

/** Give a member a prior visit so newly shared material can be exercised in browser tests. */
export async function beginReturnVisit(
  request: APIRequestContext,
  member: TestUser,
  campaignId: string,
): Promise<void> {
  const first = await request.post(`/api/campaigns/${campaignId}/visit`, {
    headers: member.headers,
  });
  expect(first.ok()).toBeTruthy();
  expect((await first.json()).newSinceAt).toBeNull();
  const url =
    process.env.LOOPKEEPER_TEST_DATABASE_URL ??
    'postgresql://loopkeeper:loopkeeper@localhost:5434/loopkeeper_test';
  if (new URL(url).pathname !== '/loopkeeper_test')
    throw new Error('Test database required');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query(
      `UPDATE campaign_participant_states SET "lastVisitAt" = NOW() - INTERVAL '2 hours'
       WHERE "memberId" = (SELECT "memberId" FROM campaign_members WHERE "campaignId" = $1 AND "userId" = $2)`,
      [campaignId, member.userId],
    );
  } finally {
    await db.end();
  }
  const next = await request.post(`/api/campaigns/${campaignId}/visit`, {
    headers: member.headers,
  });
  expect(next.ok()).toBeTruthy();
  expect((await next.json()).newSinceAt).not.toBeNull();
}

const kidData = {
  age: 13,
  type: 'COMPUTER_GEEK',
  body: 3,
  tech: 4,
  heart: 2,
  mind: 3,
  force: 1,
  move: 2,
  sneak: 2,
  tinker: 3,
  program: 3,
  calculate: 2,
  contact: 1,
  charm: 1,
  lead: 0,
  investigate: 2,
  comprehend: 2,
  empathize: 1,
  drive: 'Узнать правду о машинах.',
  pride: 'Никогда не бросаю друзей.',
  problem: 'Родители меня не понимают.',
  anchor: 'Старшая сестра.',
  iconicItem: 'Кассетный магнитофон',
};

export async function createPlayerCharacter(
  request: APIRequestContext,
  player: TestUser,
  campaignId: string,
  name: string,
): Promise<string> {
  const [template] = await json<Array<{ templateId: string }>>(
    await request.get('/api/game-systems/TALES_FROM_THE_LOOP/templates', {
      headers: player.headers,
    }),
  );
  const character = await json<{ characterId: string }>(
    await request.post(`/api/campaigns/${campaignId}/characters`, {
      headers: player.headers,
      data: { name, templateId: template.templateId, data: kidData },
    }),
  );
  return character.characterId;
}

export async function createFreeCard(
  request: APIRequestContext,
  user: TestUser,
  campaignId: string,
  title: string,
  position: { x: number; y: number },
): Promise<string> {
  const card = await json<{ cardId: string }>(
    await request.post(`/api/campaigns/${campaignId}/cards`, {
      headers: user.headers,
      data: { cardKind: 'FREE', title, tags: [] },
    }),
  );
  await json(
    await request.patch(`/api/investigation-board/nodes/${card.cardId}`, {
      headers: user.headers,
      data: { ...position, width: 240, height: 160 },
    }),
  );
  return card.cardId;
}

export type BoardSnapshot = {
  cards: Array<{
    cardId: string;
    title: string;
    tags: string[];
    node?: { x: number; y: number; width: number; height: number } | null;
  }>;
  links: Array<{ linkId: string; fromCardId: string; toCardId: string }>;
};

export async function getBoard(
  request: APIRequestContext,
  user: TestUser,
  campaignId: string,
): Promise<BoardSnapshot> {
  return json<BoardSnapshot>(
    await request.get(`/api/campaigns/${campaignId}/investigation-board`, {
      headers: user.headers,
    }),
  );
}

export type ElementType = 'NOTE' | 'LOCATION' | 'NPC' | 'OTHER';
export type ElementAccess = 'PRIVATE' | 'MASTER_ONLY' | 'SHARED';

export async function createElement(
  request: APIRequestContext,
  author: TestUser,
  campaignId: string,
  data: {
    type: ElementType;
    title: string;
    content?: string;
    access?: ElementAccess;
    typeData?: Record<string, string>;
  },
): Promise<string> {
  const element = await json<{ elementId: string }>(
    await request.post(`/api/campaigns/${campaignId}/elements`, {
      headers: author.headers,
      data,
    }),
  );
  return element.elementId;
}

export async function listElementTitles(
  request: APIRequestContext,
  user: TestUser,
  campaignId: string,
): Promise<string[]> {
  const elements = await json<Array<{ title: string }>>(
    await request.get(`/api/campaigns/${campaignId}/elements`, {
      headers: user.headers,
    }),
  );
  return elements.map((element) => element.title);
}

export async function listCampaignTitles(
  request: APIRequestContext,
  user: TestUser,
): Promise<string[]> {
  const campaigns = await json<Array<{ title: string }>>(
    await request.get('/api/campaigns', { headers: user.headers }),
  );
  return campaigns.map((campaign) => campaign.title);
}

/** A second, independent browser session (its own cookies) for another user. */
export async function openAs(
  browser: Browser,
  user: TestUser,
  path: string,
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, user);
  await page.goto(path);
  return page;
}

export async function createElementCard(
  request: APIRequestContext,
  user: TestUser,
  campaignId: string,
  elementId: string,
  node: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const card = await json<{ cardId: string }>(
    await request.post(`/api/campaigns/${campaignId}/cards`, {
      headers: user.headers,
      data: { cardKind: 'ELEMENT_REFERENCE', elementId, tags: [] },
    }),
  );
  await json(
    await request.patch(`/api/investigation-board/nodes/${card.cardId}`, {
      headers: user.headers,
      data: node,
    }),
  );
  return card.cardId;
}

/** Uploads through a purpose-specific endpoint and returns the new `/media/…` URL holder. */
export async function uploadMedia(
  request: APIRequestContext,
  user: TestUser,
  endpoint: string,
  buffer: Buffer,
): Promise<void> {
  await json(
    await request.post(`/api${endpoint}`, {
      headers: user.headers,
      multipart: {
        file: { name: 'image.png', mimeType: 'image/png', buffer },
      },
    }),
  );
}

/** Uploads a local background and shows it to every member of the campaign. */
export async function setFixedBackground(
  request: APIRequestContext,
  owner: TestUser,
  campaignId: string,
  image: Buffer,
): Promise<string> {
  const background = await json<{
    backgroundId: string;
    name: string;
    imageUrl: string;
  }>(
    await request.post(`/api/campaigns/${campaignId}/backgrounds`, {
      headers: owner.headers,
      multipart: {
        file: { name: 'background.png', mimeType: 'image/png', buffer: image },
      },
    }),
  );
  await json(
    await request.patch(`/api/campaigns/${campaignId}/background-settings`, {
      headers: owner.headers,
      data: {
        selectionMode: 'FIXED',
        fixedBackgroundId: background.backgroundId,
        backgrounds: [
          {
            backgroundId: background.backgroundId,
            name: background.name || 'Туман',
            imageUrl: background.imageUrl,
            isEnabled: true,
            sortOrder: 0,
          },
        ],
      },
    }),
  );
  return background.imageUrl;
}
