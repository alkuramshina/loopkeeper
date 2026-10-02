import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { getTestDatabaseUrl } from './helpers/test-environment';

describe('Entity views migration', () => {
  it('backfills exactly the visible pairs for every role, preserves visits and domain data', async () => {
    const client = new Client({ connectionString: getTestDatabaseUrl() });
    await client.connect();
    try {
      // The fixture lives in its own test-only schema; no production or other test data is changed.
      await client.query(`CREATE SCHEMA b4_migration_fixture; SET search_path TO b4_migration_fixture;
        CREATE TABLE campaigns ("campaignId" TEXT PRIMARY KEY);
        CREATE TABLE campaign_members ("memberId" TEXT PRIMARY KEY, "campaignId" TEXT, "userId" TEXT, "campaignRole" TEXT);
        CREATE TABLE campaign_participant_states ("memberId" TEXT PRIMARY KEY, "lastVisitAt" TIMESTAMP(3), "newSinceAt" TIMESTAMP(3));
        CREATE TABLE campaign_elements ("elementId" TEXT PRIMARY KEY, "campaignId" TEXT, "createdById" TEXT, "access" TEXT);
        CREATE TABLE characters ("characterId" TEXT PRIMARY KEY);
        CREATE TABLE investigation_cards ("cardId" TEXT PRIMARY KEY, "campaignId" TEXT, "cardKind" TEXT, "elementId" TEXT, "characterId" TEXT);
        CREATE TABLE investigation_links ("linkId" TEXT PRIMARY KEY, "campaignId" TEXT, "fromCardId" TEXT, "toCardId" TEXT);
        INSERT INTO campaigns VALUES ('c'), ('foreign');
        INSERT INTO campaign_members VALUES ('owner','c','o','OWNER'), ('player','c','p','PLAYER'), ('viewer','c','v','VIEWER'), ('former','c','f','VIEWER'), ('other','foreign','x','OWNER');
        INSERT INTO campaign_participant_states VALUES ('player','2026-09-30 10:00:00','2026-09-29 10:00:00');
        INSERT INTO campaign_elements VALUES ('shared','c','o','SHARED'), ('master','c','o','MASTER_ONLY'), ('player-master','c','p','MASTER_ONLY'), ('private','c','p','PRIVATE'), ('former-private','c','f','PRIVATE'), ('foreign','foreign','x','SHARED');
        INSERT INTO characters VALUES ('pc');
        INSERT INTO investigation_cards VALUES ('free','c','FREE',NULL,NULL), ('reference','c','ELEMENT_REFERENCE','shared',NULL), ('hidden','c','ELEMENT_REFERENCE','master',NULL), ('pc-card','c','CHARACTER_REFERENCE',NULL,'pc');
        INSERT INTO investigation_links VALUES ('visible-link','c','free','reference'), ('hidden-link','c','free','hidden');`);
      const before = await client.query(
        'SELECT * FROM campaign_elements ORDER BY "elementId"',
      );
      const visitsBefore = await client.query(
        'SELECT "lastVisitAt" FROM campaign_participant_states',
      );
      const migration = readFileSync(
        join(
          process.cwd(),
          'prisma/migrations/20261002120000_entity_views/migration.sql',
        ),
        'utf8',
      );
      await client.query(migration);
      const rows = (
        await client.query(
          'SELECT "memberId", "entityType", "entityId", "seenAt" FROM entity_views',
        )
      ).rows;
      const elements = (memberId: string) =>
        rows
          .filter(
            (row) => row.memberId === memberId && row.entityType === 'ELEMENT',
          )
          .map((row) => row.entityId)
          .sort();
      expect(elements('owner')).toEqual(['master', 'player-master', 'shared']);
      expect(elements('player')).toEqual([
        'player-master',
        'private',
        'shared',
      ]);
      expect(elements('viewer')).toEqual(['shared']);
      expect(elements('former')).toEqual(['shared']);
      expect(elements('other')).toEqual(['foreign']);
      expect(rows).toHaveLength(25);
      expect(
        new Set(rows.map((row) => new Date(row.seenAt).toISOString())).size,
      ).toBe(1);
      expect(
        rows.some((row) => ['hidden', 'hidden-link'].includes(row.entityId)),
      ).toBe(false);
      expect(
        (
          await client.query(
            'SELECT * FROM campaign_elements ORDER BY "elementId"',
          )
        ).rows,
      ).toEqual(before.rows);
      expect(
        (
          await client.query(
            'SELECT "lastVisitAt" FROM campaign_participant_states',
          )
        ).rows,
      ).toEqual(visitsBefore.rows);
      expect(
        (await client.query('SELECT * FROM campaign_participant_states'))
          .rows[0],
      ).not.toHaveProperty('newSinceAt');
      expect(
        (await client.query('SELECT * FROM campaign_participant_states'))
          .rowCount,
      ).toBe(1);
    } finally {
      await client.query(
        'ROLLBACK; SET search_path TO public; DROP SCHEMA IF EXISTS b4_migration_fixture CASCADE',
      );
      await client.end();
    }
  });
});
