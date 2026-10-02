import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

type Actor = { Authorization: string; userId: string };
describe('Entity views (e2e)', () => {
  let app: INestApplication;
  let owner: Actor, player: Actor, viewer: Actor, outsider: Actor;
  let campaignId: string;
  const db = getTestPrisma();
  const server = () => app.getHttpServer();
  const auth = (actor: Actor) => ({ Authorization: actor.Authorization });
  async function register(name: string): Promise<Actor> {
    const response = await request(server())
      .post('/auth/register')
      .send({
        email: `${name}@example.test`,
        name,
        password: 'test-password-123',
      })
      .expect(201);
    const profile = await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);
    return {
      Authorization: `Bearer ${response.body.accessToken}`,
      userId: profile.body.userId,
    };
  }
  async function invite(actor: Actor, role: 'PLAYER' | 'VIEWER') {
    const invitation = await request(server())
      .post(`/campaigns/${campaignId}/invitations`)
      .set(auth(owner))
      .send({ role })
      .expect(201);
    await request(server())
      .post(`/invitations/${invitation.body.token}/accept`)
      .set(auth(actor))
      .expect(201);
  }
  const element = async (actor: Actor, access: string = 'SHARED') =>
    (
      await request(server())
        .post(`/campaigns/${campaignId}/elements`)
        .set(auth(actor))
        .send({ type: 'NOTE', title: 'A clue', access })
        .expect(201)
    ).body;
  const card = async (
    actor = owner,
    source?: { elementId?: string; characterId?: string },
  ) =>
    (
      await request(server())
        .post(`/campaigns/${campaignId}/cards`)
        .set(auth(actor))
        .send(
          source
            ? {
                cardKind: source.elementId
                  ? 'ELEMENT_REFERENCE'
                  : 'CHARACTER_REFERENCE',
                ...source,
              }
            : { title: 'A card' },
        )
        .expect(201)
    ).body;
  const link = async (a: string, b: string) =>
    (
      await request(server())
        .post(`/campaigns/${campaignId}/investigation-links`)
        .set(auth(owner))
        .send({ cardAId: a, cardBId: b })
        .expect(201)
    ).body;
  const mark = (
    actor: Actor,
    entities: { entityType: string; entityId: string }[],
  ) =>
    request(server())
      .post(`/campaigns/${campaignId}/views`)
      .set(auth(actor))
      .send({ entities });
  const read = async (actor: Actor, id: string) =>
    (
      await request(server())
        .get(`/elements/${id}`)
        .set(auth(actor))
        .expect(200)
    ).body;
  const count = async (actor: Actor) =>
    (
      await request(server())
        .get(`/campaigns/${campaignId}`)
        .set(auth(actor))
        .expect(200)
    ).body.newVisibleMaterialCount;
  const setAccess = (id: string, access: string) =>
    request(server())
      .patch(`/elements/${id}/access`)
      .set(auth(owner))
      .send({ access })
      .expect(200);
  const member = (actor: Actor) =>
    db.campaignMember.findUniqueOrThrow({
      where: { userId_campaignId: { userId: actor.userId, campaignId } },
    });

  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    owner = await register('owner');
    player = await register('player');
    viewer = await register('viewer');
    outsider = await register('outsider');
    const campaign = await request(server())
      .post('/campaigns')
      .set(auth(owner))
      .send({ title: 'Mystery', system: 'TALES_FROM_THE_LOOP' })
      .expect(201);
    campaignId = campaign.body.campaignId;
    await invite(player, 'PLAYER');
    await invite(viewer, 'VIEWER');
  }, 15000);
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  it('uses the same visibility/author/view rule for all roles, without participant state or visit boundaries', async () => {
    const shared = await element(owner);
    const forMaster = await element(player, 'MASTER_ONLY');
    const privateNote = await element(player, 'PRIVATE');
    expect(shared.isNew).toBe(false);
    expect(await count(owner)).toBe(1);
    expect(await count(player)).toBe(1);
    expect(await count(viewer)).toBe(1);
    expect((await read(owner, forMaster.elementId)).isNew).toBe(true);
    await request(server())
      .get(`/elements/${privateNote.elementId}`)
      .set(auth(owner))
      .expect(404);
    await mark(owner, [
      { entityType: 'ELEMENT', entityId: privateNote.elementId },
    ])
      .expect(404)
      .expect((r) => expect(r.body.code).toBe('views.entity_not_found'));
    for (const actor of [owner, player, viewer]) {
      for (let i = 0; i < 2; i++)
        await request(server())
          .post(`/campaigns/${campaignId}/visit`)
          .set(auth(actor))
          .expect(200)
          .expect((r) => {
            expect(r.body.lastVisitAt).toEqual(expect.any(String));
            expect(r.body).not.toHaveProperty('newSinceAt');
          });
      expect(await count(actor)).toBe(1);
    }
    await mark(viewer, [
      { entityType: 'ELEMENT', entityId: shared.elementId },
    ]).expect(204);
    expect((await read(viewer, shared.elementId)).isNew).toBe(false);
    expect((await read(player, shared.elementId)).isNew).toBe(true);
    expect(await count(viewer)).toBe(0);
    await mark(owner, [
      { entityType: 'ELEMENT', entityId: forMaster.elementId },
    ]).expect(204);
    expect(await count(owner)).toBe(0);
    const list = await request(server())
      .get('/campaigns')
      .set(auth(player))
      .expect(200);
    expect(list.body[0].newVisibleMaterialCount).toBe(1);
    // Author exclusion still applies even if the creation view is missing.
    await db.entityView.deleteMany({
      where: { memberId: (await member(owner)).memberId },
    });
    expect((await read(owner, shared.elementId)).isNew).toBe(false);
  });

  it('validates the raw batch and rejects identity/timestamp injection', async () => {
    const item = { entityType: 'ELEMENT', entityId: randomUUID() };
    for (const body of [
      { entities: [] },
      { entities: Array(501).fill(item) },
      { entities: [{ ...item, entityType: 'CHARACTER' }] },
      { entities: [{ ...item, entityId: 'invalid' }] },
      { entities: [item], memberId: randomUUID() },
      { entities: [{ ...item, seenAt: new Date().toISOString() }] },
      { board: true },
      { entities: [null] },
    ]) {
      await request(server())
        .post(`/campaigns/${campaignId}/views`)
        .set(auth(player))
        .send(body)
        .expect(400)
        .expect((r) => {
          expect(r.body.code).toBe('validation.failed');
          expect(r.body.violations.length).toBeGreaterThan(0);
        });
    }
  });

  it('is atomic and tenant neutral for absent, hidden, cross-campaign and wrong-type IDs', async () => {
    const shared = await element(owner),
      hidden = await element(owner, 'MASTER_ONLY');
    const otherCampaign = await request(server())
      .post('/campaigns')
      .set(auth(owner))
      .send({ title: 'Other' })
      .expect(201);
    const foreign = await request(server())
      .post(`/campaigns/${otherCampaign.body.campaignId}/elements`)
      .set(auth(owner))
      .send({ type: 'NOTE', title: 'Other', access: 'SHARED' })
      .expect(201);
    for (const id of [hidden.elementId, randomUUID(), foreign.body.elementId]) {
      await mark(player, [
        { entityType: 'ELEMENT', entityId: shared.elementId },
        { entityType: 'ELEMENT', entityId: id },
      ])
        .expect(404)
        .expect((r) => {
          expect(r.body.code).toBe('views.entity_not_found');
          expect(r.body.message).toBe('The requested entity is unavailable');
          expect(r.body).not.toHaveProperty('violations');
        });
      expect((await read(player, shared.elementId)).isNew).toBe(true);
    }
    await mark(player, [
      { entityType: 'ELEMENT', entityId: shared.elementId },
      { entityType: 'BOARD_CARD', entityId: shared.elementId },
    ]).expect(404);
    await mark(outsider, [
      { entityType: 'ELEMENT', entityId: shared.elementId },
    ])
      .expect(404)
      .expect((r) => expect(r.body.code).toBe('campaign.not_found'));
  });

  it('deduplicates mixed batches and keeps the first seenAt under concurrent repeats; board references are independent', async () => {
    const source = await element(owner),
      a = await card(owner, { elementId: source.elementId }),
      b = await card(player),
      edge = await link(a.cardId, b.cardId);
    await mark(player, [
      { entityType: 'ELEMENT', entityId: source.elementId },
    ]).expect(204);
    const board = await request(server())
      .get(`/campaigns/${campaignId}/investigation-board`)
      .set(auth(player))
      .expect(200);
    expect(board.body.cards.find((c) => c.cardId === a.cardId).isNew).toBe(
      true,
    );
    expect(board.body.cards.find((c) => c.cardId === b.cardId).isNew).toBe(
      false,
    );
    const batch = [
      { entityType: 'ELEMENT', entityId: source.elementId },
      { entityType: 'BOARD_CARD', entityId: a.cardId },
      { entityType: 'BOARD_LINK', entityId: edge.linkId },
    ];
    await mark(player, [...batch, ...batch]).expect(204);
    const rows = await db.entityView.findMany({
      where: { memberId: (await member(player)).memberId },
      orderBy: { entityId: 'asc' },
    });
    await Promise.all([
      mark(player, batch).expect(204),
      mark(player, batch).expect(204),
    ]);
    expect(
      await db.entityView.findMany({
        where: { memberId: (await member(player)).memberId },
        orderBy: { entityId: 'asc' },
      }),
    ).toEqual(rows);
    const fresh = await card(owner);
    await mark(viewer, [
      { entityType: 'BOARD_CARD', entityId: fresh.cardId },
    ]).expect(204);
    expect((await read(viewer, source.elementId)).isNew).toBe(true);
    // A snapshot does not consume a card created after it was read.
    await mark(
      viewer,
      board.body.cards.map((c) => ({
        entityType: 'BOARD_CARD',
        entityId: c.cardId,
      })),
    ).expect(204);
    const later = await card(owner);
    expect(
      (
        await request(server())
          .get(`/campaigns/${campaignId}/investigation-board`)
          .set(auth(viewer))
      ).body.cards.find((c) => c.cardId === later.cardId).isNew,
    ).toBe(true);
  });

  it('retains element views when hidden/reopened and clears card/link views in every element cascade', async () => {
    const source = await element(owner),
      a = await card(owner, { elementId: source.elementId }),
      b = await card(),
      edge = await link(a.cardId, b.cardId);
    await mark(player, [
      { entityType: 'ELEMENT', entityId: source.elementId },
      { entityType: 'BOARD_CARD', entityId: a.cardId },
      { entityType: 'BOARD_LINK', entityId: edge.linkId },
    ]).expect(204);
    await setAccess(source.elementId, 'MASTER_ONLY');
    expect(
      await db.entityView.count({
        where: { entityId: { in: [a.cardId, edge.linkId] } },
      }),
    ).toBe(0);
    expect(
      await db.entityView.count({ where: { entityId: source.elementId } }),
    ).toBe(2);
    await setAccess(source.elementId, 'SHARED');
    expect((await read(player, source.elementId)).isNew).toBe(false);
    expect((await read(viewer, source.elementId)).isNew).toBe(true);
    const replacement = await card(owner, { elementId: source.elementId });
    const nextEdge = await link(replacement.cardId, b.cardId);
    await request(server())
      .delete(`/elements/${source.elementId}`)
      .set(auth(owner))
      .expect(200);
    expect(
      await db.entityView.count({
        where: {
          entityId: {
            in: [source.elementId, replacement.cardId, nextEdge.linkId],
          },
        },
      }),
    ).toBe(0);
  });

  it('clears direct links, card cascades and character-reference cascades', async () => {
    const a = await card(),
      b = await card(),
      edge = await link(a.cardId, b.cardId);
    await request(server())
      .delete(`/investigation-links/${edge.linkId}`)
      .set(auth(player))
      .expect(200);
    expect(
      await db.entityView.count({ where: { entityId: edge.linkId } }),
    ).toBe(0);
    const edge2 = await link(a.cardId, b.cardId);
    await request(server())
      .delete(`/cards/${a.cardId}`)
      .set(auth(player))
      .expect(200);
    expect(
      await db.entityView.count({
        where: { entityId: { in: [a.cardId, edge2.linkId] } },
      }),
    ).toBe(0);
    const character = await db.character.create({
      data: {
        campaignId,
        ownerId: player.userId,

        name: 'A kid',
      },
    });
    const pc = await card(owner, { characterId: character.characterId }),
      pcLink = await link(pc.cardId, b.cardId);
    await mark(viewer, [
      { entityType: 'BOARD_CARD', entityId: pc.cardId },
      { entityType: 'BOARD_LINK', entityId: pcLink.linkId },
    ]).expect(204);
    await request(server())
      .delete(`/characters/${character.characterId}`)
      .set(auth(player))
      .expect(200);
    expect(
      await db.entityView.count({
        where: { entityId: { in: [pc.cardId, pcLink.linkId] } },
      }),
    ).toBe(0);
  });

  it('preserves views across role changes and resets them on new membership', async () => {
    const shared = await element(owner),
      hidden = await element(owner, 'MASTER_ONLY'),
      own = await element(player, 'PRIVATE');
    await mark(player, [
      { entityType: 'ELEMENT', entityId: shared.elementId },
    ]).expect(204);
    const oldMember = await member(player);
    await request(server())
      .patch(`/campaigns/${campaignId}/members/${player.userId}`)
      .set(auth(owner))
      .send({ role: 'VIEWER' })
      .expect(200);
    expect((await read(player, shared.elementId)).isNew).toBe(false);
    await mark(player, [
      { entityType: 'ELEMENT', entityId: own.elementId },
    ]).expect(404);
    await request(server())
      .get(`/elements/${own.elementId}`)
      .set(auth(player))
      .expect(404);
    await request(server())
      .patch(`/campaigns/${campaignId}/members/${player.userId}`)
      .set(auth(owner))
      .send({ role: 'PLAYER' })
      .expect(200);
    expect((await read(player, own.elementId)).isNew).toBe(false);
    await setAccess(hidden.elementId, 'SHARED');
    expect((await read(player, hidden.elementId)).isNew).toBe(true);
    await request(server())
      .delete(`/campaigns/${campaignId}/members/${player.userId}`)
      .set(auth(owner))
      .expect(200);
    expect(
      await db.entityView.count({ where: { memberId: oldMember.memberId } }),
    ).toBe(0);
    await invite(player, 'PLAYER');
    expect((await member(player)).memberId).not.toBe(oldMember.memberId);
    expect((await read(player, shared.elementId)).isNew).toBe(true);
    expect((await read(player, own.elementId)).isNew).toBe(false);
  });

  it('serializes view/delete and view/hide races without orphan rows, and cascades campaign views', async () => {
    for (const remove of [false, true]) {
      const source = await element(owner),
        reference = await card(owner, { elementId: source.elementId }),
        other = await card(),
        edge = await link(reference.cardId, other.cardId);
      const entities = [
        { entityType: 'ELEMENT', entityId: source.elementId },
        { entityType: 'BOARD_CARD', entityId: reference.cardId },
        { entityType: 'BOARD_LINK', entityId: edge.linkId },
      ];
      const [viewResult] = await Promise.all([
        mark(player, entities),
        remove
          ? request(server())
              .delete(`/elements/${source.elementId}`)
              .set(auth(owner))
              .expect(200)
          : setAccess(source.elementId, 'MASTER_ONLY'),
      ]);
      expect([204, 404]).toContain(viewResult.status);
      expect(
        await db.entityView.count({
          where: {
            entityId: {
              in: [
                reference.cardId,
                edge.linkId,
                ...(remove ? [source.elementId] : []),
              ],
            },
          },
        }),
      ).toBe(0);
    }
    await request(server())
      .delete(`/campaigns/${campaignId}`)
      .set(auth(owner))
      .expect(200);
    expect(await db.entityView.count()).toBe(0);
  });
});
