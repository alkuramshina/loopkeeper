import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/app';
import {
  closeTestDatabase,
  getTestPrisma,
  resetTestDatabase,
} from './helpers/database';

type User = { headers: { Authorization: string }; userId: string };
const password = 'test-password-123';

describe('Campaign membership lifecycle (e2e)', () => {
  let app: INestApplication;
  beforeEach(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });
  afterEach(async () => app.close());
  afterAll(async () => closeTestDatabase());

  const http = () => request(app.getHttpServer());

  async function register(email: string): Promise<User> {
    const response = await http()
      .post('/auth/register')
      .send({ email, password, name: email })
      .expect(201);
    const headers = { Authorization: `Bearer ${response.body.accessToken}` };
    const me = await http().get('/auth/me').set(headers).expect(200);
    return { headers, userId: me.body.userId };
  }

  async function invite(owner: User, campaignId: string, role: string) {
    const response = await http()
      .post(`/campaigns/${campaignId}/invitations`)
      .set(owner.headers)
      .send({ role })
      .expect(201);
    return response.body as { invitationId: string; token: string };
  }

  async function setup() {
    const owner = await register('owner@loopkeeper.dev');
    const player = await register('player@loopkeeper.dev');
    const viewer = await register('viewer@loopkeeper.dev');
    const outsider = await register('outsider@loopkeeper.dev');
    const campaign = await http()
      .post('/campaigns')
      .set(owner.headers)
      .send({ title: 'Mystery', description: 'A campaign' })
      .expect(201);
    const campaignId: string = campaign.body.campaignId;
    for (const [user, role] of [
      [player, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      const { token } = await invite(owner, campaignId, role);
      await http()
        .post(`/invitations/${token}/accept`)
        .set(user.headers)
        .expect(201);
    }
    return { owner, player, viewer, outsider, campaignId };
  }

  it('lists each campaign with the current role of every participant', async () => {
    const { owner, player, viewer, outsider, campaignId } = await setup();

    for (const [user, role] of [
      [owner, 'OWNER'],
      [player, 'PLAYER'],
      [viewer, 'VIEWER'],
    ] as const) {
      await http()
        .get('/campaigns')
        .set(user.headers)
        .expect(200)
        .expect((response) =>
          expect(response.body).toEqual([
            expect.objectContaining({ campaignId, currentUserRole: role }),
          ]),
        );
    }
    await http().get('/campaigns').set(outsider.headers).expect(200, []);
  });

  it('keeps member and invitation management with the owner only', async () => {
    const { owner, player, viewer, outsider, campaignId } = await setup();

    await http()
      .get(`/campaigns/${campaignId}/members`)
      .set(owner.headers)
      .expect(200)
      .expect((response) => {
        expect(
          response.body.map((member: { campaignRole: string }) => [
            member.campaignRole,
          ]),
        ).toEqual([['OWNER'], ['PLAYER'], ['VIEWER']]);
        expect(response.body[0].user).toEqual(
          expect.objectContaining({ userId: owner.userId }),
        );
        expect(response.body[1].user).toEqual(
          expect.objectContaining({ userId: player.userId }),
        );
        expect(response.body[1].user).not.toHaveProperty('passwordHash');
      });
    await http()
      .get(`/campaigns/${campaignId}/invitations`)
      .set(owner.headers)
      .expect(200)
      .expect((response) => {
        expect(response.body).toHaveLength(2);
        for (const invitation of response.body) {
          expect(invitation.acceptedAt).not.toBeNull();
          expect(invitation).not.toHaveProperty('token');
          expect(invitation).not.toHaveProperty('tokenHash');
        }
      });

    const active = await invite(owner, campaignId, 'PLAYER');
    for (const user of [player, viewer, outsider]) {
      await http()
        .get(`/campaigns/${campaignId}/members`)
        .set(user.headers)
        .expect(404);
      await http()
        .patch(`/campaigns/${campaignId}/members/${viewer.userId}`)
        .set(user.headers)
        .send({ role: 'PLAYER' })
        .expect(404);
      await http()
        .delete(`/campaigns/${campaignId}/members/${viewer.userId}`)
        .set(user.headers)
        .expect(404);
      await http()
        .get(`/campaigns/${campaignId}/invitations`)
        .set(user.headers)
        .expect(404);
      await http()
        .post(`/campaigns/${campaignId}/invitations`)
        .set(user.headers)
        .send({ role: 'PLAYER' })
        .expect(404);
      await http()
        .delete(`/campaigns/${campaignId}/invitations/${active.invitationId}`)
        .set(user.headers)
        .expect(404);
    }

    // The OWNER row can be neither re-roled nor removed, and OWNER can be
    // granted neither by role change nor by invitation.
    for (const role of ['VIEWER', 'PLAYER']) {
      await http()
        .patch(`/campaigns/${campaignId}/members/${owner.userId}`)
        .set(owner.headers)
        .send({ role })
        .expect(409)
        .expect((response) =>
          expect(response.body.code).toBe('member.owner_protected'),
        );
    }
    await http()
      .delete(`/campaigns/${campaignId}/members/${owner.userId}`)
      .set(owner.headers)
      .expect(409)
      .expect((response) =>
        expect(response.body.code).toBe('member.owner_protected'),
      );
    await http()
      .patch(`/campaigns/${campaignId}/members/${player.userId}`)
      .set(owner.headers)
      .send({ role: 'OWNER' })
      .expect(400);
    await http()
      .delete(`/campaigns/${campaignId}/members/${outsider.userId}`)
      .set(owner.headers)
      .expect(404)
      .expect((response) =>
        expect(response.body.code).toBe('member.not_found'),
      );
    await http()
      .post(`/campaigns/${campaignId}/invitations`)
      .set(owner.headers)
      .send({ role: 'OWNER' })
      .expect(400);
    for (const user of [player, viewer]) {
      await http()
        .delete(`/campaigns/${campaignId}/members/${owner.userId}`)
        .set(user.headers)
        .expect(404);
    }
    await http()
      .get(`/campaigns/${campaignId}`)
      .set(owner.headers)
      .expect(200)
      .expect((response) =>
        expect(response.body.currentUserRole).toBe('OWNER'),
      );

    // A revoked invitation cannot be revoked twice or accepted.
    await http()
      .delete(`/campaigns/${campaignId}/invitations/${active.invitationId}`)
      .set(owner.headers)
      .expect(200);
    await http()
      .delete(`/campaigns/${campaignId}/invitations/${active.invitationId}`)
      .set(owner.headers)
      .expect(404);
    await http()
      .post(`/invitations/${active.token}/accept`)
      .set(outsider.headers)
      .expect(404)
      .expect((response) =>
        expect(response.body.code).toBe('invitation.not_found'),
      );
  });

  it('rejects invitations for the owner and existing members without using them up', async () => {
    const { owner, player, outsider, campaignId } = await setup();
    const { token } = await invite(owner, campaignId, 'VIEWER');

    for (const user of [owner, player]) {
      await http()
        .post(`/invitations/${token}/accept`)
        .set(user.headers)
        .expect(409)
        .expect((response) =>
          expect(response.body.code).toBe('invitation.already_member'),
        );
    }
    await http()
      .post(`/invitations/${token}/accept`)
      .set(outsider.headers)
      .expect(201)
      .expect((response) => expect(response.body.campaignRole).toBe('VIEWER'));

    for (const malformed of ['no-dot', 'a.b.c', `${token}x`]) {
      await http()
        .post(`/invitations/${malformed}/accept`)
        .set(player.headers)
        .expect(404);
    }
  });

  it('applies role changes and removal to every campaign resource immediately', async () => {
    const { owner, player, viewer, campaignId } = await setup();
    const sharedNote = await http()
      .post(`/campaigns/${campaignId}/elements`)
      .set(player.headers)
      .send({ type: 'NOTE', title: 'Shared clue', access: 'SHARED' })
      .expect(201);

    // Viewer promoted to player can contribute to the board and write notes.
    await http()
      .patch(`/campaigns/${campaignId}/members/${viewer.userId}`)
      .set(owner.headers)
      .send({ role: 'PLAYER' })
      .expect(200)
      .expect((response) => expect(response.body.campaignRole).toBe('PLAYER'));
    await http()
      .post(`/campaigns/${campaignId}/cards`)
      .set(viewer.headers)
      .send({ title: 'Now I can write' })
      .expect(201);
    await http()
      .post(`/campaigns/${campaignId}/elements`)
      .set(viewer.headers)
      .send({ type: 'NOTE', title: 'My note' })
      .expect(201);

    // A removed player loses the campaign entirely; their shared note stays.
    await http()
      .delete(`/campaigns/${campaignId}/members/${player.userId}`)
      .set(owner.headers)
      .expect(200);
    await http().get('/campaigns').set(player.headers).expect(200, []);
    for (const path of [
      `/campaigns/${campaignId}`,
      `/campaigns/${campaignId}/elements`,
      `/campaigns/${campaignId}/characters`,
      `/campaigns/${campaignId}/investigation-board`,
      `/elements/${sharedNote.body.elementId}`,
    ]) {
      await http().get(path).set(player.headers).expect(404);
    }
    await http()
      .patch(`/elements/${sharedNote.body.elementId}`)
      .set(player.headers)
      .send({ title: 'Still mine?' })
      .expect(404);
    await http()
      .get(`/elements/${sharedNote.body.elementId}`)
      .set(viewer.headers)
      .expect(200)
      .expect((response) =>
        expect(response.body.createdBy.userId).toBe(player.userId),
      );
    await http()
      .get(`/campaigns/${campaignId}/members`)
      .set(owner.headers)
      .expect(200)
      .expect((response) => expect(response.body).toHaveLength(2));

    // A removed user may come back through a new invitation.
    const { token } = await invite(owner, campaignId, 'VIEWER');
    await http()
      .post(`/invitations/${token}/accept`)
      .set(player.headers)
      .expect(201);
    await http()
      .get(`/campaigns/${campaignId}`)
      .set(player.headers)
      .expect(200)
      .expect((response) =>
        expect(response.body.currentUserRole).toBe('VIEWER'),
      );
  });

  it('keeps exactly one OWNER member per campaign', async () => {
    const { owner, player, campaignId } = await setup();
    const prisma = getTestPrisma();

    expect(
      await prisma.campaignMember.findMany({
        where: { campaignId, campaignRole: 'OWNER' },
        select: { userId: true },
      }),
    ).toEqual([{ userId: owner.userId }]);
    // The partial unique index rejects a second owner even outside the API.
    await expect(
      prisma.campaignMember.update({
        where: { userId_campaignId: { userId: player.userId, campaignId } },
        data: { campaignRole: 'OWNER' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    // Every campaign gets its own owner row.
    const second = await http()
      .post('/campaigns')
      .set(player.headers)
      .send({ title: 'Second', description: 'Another campaign' })
      .expect(201)
      .expect((response) =>
        expect(response.body.currentUserRole).toBe('OWNER'),
      );
    expect(
      await prisma.campaignMember.count({
        where: { campaignId: second.body.campaignId, campaignRole: 'OWNER' },
      }),
    ).toBe(1);
    await http()
      .get(`/campaigns/${second.body.campaignId}`)
      .set(owner.headers)
      .expect(404)
      .expect((response) =>
        expect(response.body.code).toBe('campaign.not_found'),
      );
  });

  it('removes personal participant state together with the membership', async () => {
    const { owner, player, viewer, campaignId } = await setup();
    const prisma = getTestPrisma();
    const members = await prisma.campaignMember.findMany({
      where: { campaignId },
      select: { memberId: true },
    });
    await prisma.campaignParticipantState.createMany({
      data: members.map(({ memberId }) => ({ memberId })),
    });

    await http()
      .delete(`/campaigns/${campaignId}/members/${player.userId}`)
      .set(owner.headers)
      .expect(200);
    expect(
      await prisma.campaignParticipantState.count({
        where: { member: { campaignId } },
      }),
    ).toBe(2);
    expect(
      await prisma.campaignParticipantState.count({
        where: { member: { userId: player.userId } },
      }),
    ).toBe(0);

    await http()
      .delete(`/campaigns/${campaignId}`)
      .set(viewer.headers)
      .expect(404);
    await http()
      .delete(`/campaigns/${campaignId}`)
      .set(owner.headers)
      .expect(200);
    expect(await prisma.campaignParticipantState.count()).toBe(0);
  });
});
