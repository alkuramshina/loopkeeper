import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

type User = { accessToken: string; email: string };
const password = 'test-password-123';

async function register(app: INestApplication, email: string): Promise<User> {
  const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name: email })
    .expect(201);
  return { accessToken: response.body.accessToken, email };
}
const auth = (user: User) => ({ Authorization: `Bearer ${user.accessToken}` });

async function inviteAndAccept(
  app: INestApplication,
  owner: User,
  invitedUser: User,
  campaignId: string,
  role: 'PLAYER' | 'VIEWER',
) {
  const invitation = await request(app.getHttpServer())
    .post(`/campaigns/${campaignId}/invitations`)
    .set(auth(owner))
    .send({ role })
    .expect(201);

  await request(app.getHttpServer())
    .post(`/invitations/${invitation.body.token}/accept`)
    .set(auth(invitedUser))
    .expect(201);
}

async function campaign(app: INestApplication, owner: User, title: string) {
  const response = await request(app.getHttpServer())
    .post('/campaigns')
    .set(auth(owner))
    .send({ title, description: title })
    .expect(201);
  return response.body.campaignId as string;
}

describe('Investigation board (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  it('is collaborative for owner and players while isolating other users and campaigns', async () => {
    const owner = await register(app, 'owner@loopkeeper.dev');
    const player = await register(app, 'player@loopkeeper.dev');
    const viewer = await register(app, 'viewer@loopkeeper.dev');
    const outsider = await register(app, 'outsider@loopkeeper.dev');
    const campaignId = await campaign(app, owner, 'Mystery');
    const otherCampaignId = await campaign(app, owner, 'Other mystery');

    for (const [user, role] of [
      [player, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      await inviteAndAccept(app, owner, user, campaignId, role);
    }

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(viewer))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(outsider))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(owner))
      .expect(200)
      .expect((response) => expect(response.body.cards).toEqual([]));

    const playerCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({
        title: 'The old factory',
        content: 'Saw lights at night.',
        tags: ['location', 'lead'],
        color: '#2f80ed',
        icon: 'factory',
      })
      .expect(201);
    expect(playerCard.body.node).toMatchObject({
      x: 0,
      y: 0,
      width: 240,
      height: 160,
    });

    await request(app.getHttpServer())
      .patch(`/investigation-board/nodes/${playerCard.body.cardId}`)
      .set(auth(player))
      .send({ x: 120, y: -40, width: 320, height: 180 })
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({
          x: 120,
          y: -40,
          width: 320,
          height: 180,
        }),
      );

    const ownerCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(owner))
      .send({ title: 'Strange signal' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/cards/${ownerCard.body.cardId}`)
      .set(auth(player))
      .send({ content: 'The player can add a hypothesis.' })
      .expect(200);

    const link = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(player))
      .send({
        cardAId: ownerCard.body.cardId,
        cardBId: playerCard.body.cardId,
        label: 'heard near',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(owner))
      .send({ cardAId: playerCard.body.cardId, cardBId: ownerCard.body.cardId })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(owner))
      .send({
        cardAId: playerCard.body.cardId,
        cardBId: playerCard.body.cardId,
      })
      .expect(400);

    const otherCard = await request(app.getHttpServer())
      .post(`/campaigns/${otherCampaignId}/cards`)
      .set(auth(owner))
      .send({ title: 'Other tenant card' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/investigation-links`)
      .set(auth(player))
      .send({ cardAId: playerCard.body.cardId, cardBId: otherCard.body.cardId })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/cards/${playerCard.body.cardId}`)
      .set(auth(viewer))
      .send({ title: 'No access' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/cards/${ownerCard.body.cardId}`)
      .set(auth(player))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(player))
      .expect(200)
      .expect((response) => {
        expect(response.body.cards).toHaveLength(1);
        expect(response.body.links).toEqual([]);
        expect(response.body.cards[0].node).toMatchObject({ x: 120, y: -40 });
      });
    expect(link.body.linkId).toBeDefined();
  });

  it('adds safe source references without transferring source ownership', async () => {
    const owner = await register(app, 'owner@loopkeeper.dev');
    const player = await register(app, 'player@loopkeeper.dev');
    const campaignId = await campaign(app, owner, 'Mystery');
    const otherCampaignId = await campaign(app, owner, 'Other mystery');

    await inviteAndAccept(app, owner, player, campaignId, 'PLAYER');

    const sharedNote = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/notes`)
      .set(auth(owner))
      .send({ title: 'Shared clue', content: 'The signal returns nightly.', visibility: 'PLAYERS' })
      .expect(201);
    const privateNote = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/notes`)
      .set(auth(owner))
      .send({ title: 'Private clue', content: 'Do not share.', visibility: 'PRIVATE' })
      .expect(201);
    const otherNote = await request(app.getHttpServer())
      .post(`/campaigns/${otherCampaignId}/notes`)
      .set(auth(owner))
      .send({ title: 'Other clue', content: 'Another campaign.', visibility: 'PLAYERS' })
      .expect(201);

    const prisma = getTestPrisma();
    const [ownerRecord, playerRecord, template] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: owner.email } }),
      prisma.user.findUniqueOrThrow({ where: { email: player.email } }),
      prisma.characterTemplate.findFirstOrThrow(),
    ]);
    const [playerCharacter, npc] = await Promise.all([
      prisma.character.create({
        data: {
          campaignId,
          ownerId: playerRecord.userId,
          templateId: template.templateId,
          name: 'Alex',
          data: {},
        },
      }),
      prisma.character.create({
        data: {
          campaignId,
          ownerId: ownerRecord.userId,
          templateId: template.templateId,
          name: 'Mr. Berg',
          data: {},
          isNPC: true,
        },
      }),
    ]);

    const noteCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({ cardKind: 'NOTE_REFERENCE', noteId: sharedNote.body.noteId, tags: ['lead'] })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          cardKind: 'NOTE_REFERENCE',
          title: 'Shared clue',
          content: 'The signal returns nightly.',
          reference: { kind: 'NOTE', noteId: sharedNote.body.noteId },
        });
      });

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(owner))
      .send({ cardKind: 'CHARACTER_REFERENCE', characterId: playerCharacter.characterId })
      .expect(201)
      .expect((response) =>
        expect(response.body).toMatchObject({
          cardKind: 'CHARACTER_REFERENCE',
          title: 'Alex',
          reference: { kind: 'CHARACTER', characterId: playerCharacter.characterId, isNPC: false },
        }),
      );
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({ cardKind: 'CHARACTER_REFERENCE', characterId: npc.characterId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({ cardKind: 'NOTE_REFERENCE', noteId: privateNote.body.noteId })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({ cardKind: 'NOTE_REFERENCE', noteId: otherNote.body.noteId })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(owner))
      .send({ cardKind: 'NOTE_REFERENCE', noteId: sharedNote.body.noteId })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/cards/${noteCard.body.cardId}`)
      .set(auth(player))
      .send({ title: 'Attempt to replace source' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/notes/${sharedNote.body.noteId}`)
      .set(auth(owner))
      .send({ visibility: 'PRIVATE' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/characters/${playerCharacter.characterId}`)
      .set(auth(player))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(owner))
      .expect(200)
      .expect((response) => {
        expect(response.body.cards).toHaveLength(1);
        expect(response.body.cards[0]).toMatchObject({
          cardKind: 'CHARACTER_REFERENCE',
          characterId: npc.characterId,
        });
      });
  });
});
