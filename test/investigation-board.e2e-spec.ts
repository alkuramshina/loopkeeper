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
    const viewer = await register(app, 'viewer@loopkeeper.dev');
    const campaignId = await campaign(app, owner, 'Mystery');
    const otherCampaignId = await campaign(app, owner, 'Other mystery');

    await inviteAndAccept(app, owner, player, campaignId, 'PLAYER');
    await inviteAndAccept(app, owner, viewer, campaignId, 'VIEWER');

    const sharedElement = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(auth(owner))
      .send({
        type: 'NOTE',
        title: 'Shared clue',
        content: 'The signal returns nightly.',
        access: 'SHARED',
      })
      .expect(201);
    const privateElement = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(auth(owner))
      .send({
        type: 'NOTE',
        title: 'Private clue',
        content: 'Do not share.',
        access: 'MASTER_ONLY',
      })
      .expect(201);
    const otherElement = await request(app.getHttpServer())
      .post(`/campaigns/${otherCampaignId}/elements`)
      .set(auth(owner))
      .send({
        type: 'NOTE',
        title: 'Other clue',
        content: 'Another campaign.',
        access: 'SHARED',
      })
      .expect(201);

    const prisma = getTestPrisma();
    const [ownerRecord, playerRecord, template] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: owner.email } }),
      prisma.user.findUniqueOrThrow({ where: { email: player.email } }),
      prisma.characterTemplate.findFirstOrThrow(),
    ]);
    const playerCharacter = await prisma.character.create({
      data: {
        campaignId,
        ownerId: playerRecord.userId,
        templateId: template.templateId,
        name: 'Alex',
        data: {},
      },
    });

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(owner))
      .send({
        cardKind: 'NOTE_REFERENCE',
        elementId: sharedElement.body.elementId,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(owner))
      .send({
        title: 'Not a free element card',
        elementId: sharedElement.body.elementId,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(viewer))
      .send({
        cardKind: 'ELEMENT_REFERENCE',
        elementId: sharedElement.body.elementId,
      })
      .expect(404);

    const elementCard = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({
        cardKind: 'ELEMENT_REFERENCE',
        elementId: sharedElement.body.elementId,
        tags: ['lead'],
      })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          cardKind: 'ELEMENT_REFERENCE',
          title: 'Shared clue',
          content: 'The signal returns nightly.',
          reference: {
            kind: 'ELEMENT',
            elementId: sharedElement.body.elementId,
          },
        });
      });

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(owner))
      .send({
        cardKind: 'CHARACTER_REFERENCE',
        characterId: playerCharacter.characterId,
      })
      .expect(201)
      .expect((response) =>
        expect(response.body).toMatchObject({
          cardKind: 'CHARACTER_REFERENCE',
          title: 'Alex',
          reference: {
            kind: 'CHARACTER',
            characterId: playerCharacter.characterId,
          },
        }),
      );

    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({
        cardKind: 'ELEMENT_REFERENCE',
        elementId: privateElement.body.elementId,
      })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/cards`)
      .set(auth(player))
      .send({
        cardKind: 'ELEMENT_REFERENCE',
        elementId: otherElement.body.elementId,
      })
      .expect(404);
    const duplicates = await Promise.all(
      [owner, player].map((user) =>
        request(app.getHttpServer())
          .post(`/campaigns/${campaignId}/cards`)
          .set(auth(user))
          .send({
            cardKind: 'ELEMENT_REFERENCE',
            elementId: sharedElement.body.elementId,
          }),
      ),
    );
    expect(duplicates.map((response) => response.status)).toEqual([409, 409]);

    const concurrentSource = await request(app.getHttpServer())
      .post(`/campaigns/${campaignId}/elements`)
      .set(auth(owner))
      .send({ type: 'OTHER', title: 'Second clue', access: 'SHARED' })
      .expect(201);
    const concurrent = await Promise.all(
      [owner, player].map((user) =>
        request(app.getHttpServer())
          .post(`/campaigns/${campaignId}/cards`)
          .set(auth(user))
          .send({
            cardKind: 'ELEMENT_REFERENCE',
            elementId: concurrentSource.body.elementId,
          }),
      ),
    );
    expect(concurrent.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await request(app.getHttpServer())
      .delete(
        `/cards/${concurrent.find((response) => response.status === 201)?.body.cardId}`,
      )
      .set(auth(owner))
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/cards/${elementCard.body.cardId}`)
      .set(auth(player))
      .send({ title: 'Attempt to replace source' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/elements/${sharedElement.body.elementId}`)
      .set(auth(owner))
      .send({ access: 'MASTER_ONLY' })
      .expect(200);
    // A stale row must not expose source content or even appear as a board card.
    const staleCard = await prisma.investigationCard.create({
      data: {
        cardKind: 'ELEMENT_REFERENCE',
        campaignId,
        boardId: (
          await prisma.investigationBoard.findUniqueOrThrow({
            where: { campaignId },
          })
        ).boardId,
        createdById: ownerRecord.userId,
        elementId: privateElement.body.elementId,
        tags: [],
      },
    });

    const pcCard = await prisma.investigationCard.findFirstOrThrow({
      where: { characterId: playerCharacter.characterId, campaignId },
    });
    const hiddenLink = await prisma.investigationLink.create({
      data: {
        campaignId,
        boardId: staleCard.boardId,
        fromCardId: staleCard.cardId,
        toCardId: pcCard.cardId,
        createdById: ownerRecord.userId,
        label: 'Hidden relationship',
      },
    });
    await request(app.getHttpServer())
      .patch(`/investigation-links/${hiddenLink.linkId}`)
      .set(auth(player))
      .send({ label: 'Read hidden link' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/investigation-links/${hiddenLink.linkId}`)
      .set(auth(player))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/characters/${playerCharacter.characterId}`)
      .set(auth(player))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(owner))
      .expect(200)
      .expect((response) => {
        expect(response.body.cards).toEqual([]);
      });
  });
});
