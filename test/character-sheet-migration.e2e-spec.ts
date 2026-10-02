import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { getTestDatabaseUrl } from './helpers/test-environment';

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20261002180000_character_sheets_in_code/migration.sql',
  ),
  'utf8',
);
const legacySchema = JSON.parse(migration.match(/'({"title".*})'::jsonb/)![1]);

describe('Character sheets migration', () => {
  let client: Client;
  beforeEach(async () => {
    client = new Client({ connectionString: getTestDatabaseUrl() });
    await client.connect();
    await client.query(`CREATE SCHEMA character_sheet_fixture;
      SET search_path TO character_sheet_fixture;
      CREATE TABLE campaigns ("campaignId" TEXT PRIMARY KEY, "system" TEXT);
      CREATE TABLE character_templates ("templateId" TEXT PRIMARY KEY, "systemSlug" TEXT, "version" INT, "schema" JSONB);
      CREATE TABLE characters ("characterId" TEXT PRIMARY KEY, "campaignId" TEXT, "ownerId" TEXT, "data" JSONB,
        "templateId" TEXT CONSTRAINT "characters_templateId_fkey" REFERENCES character_templates("templateId"));
      INSERT INTO campaigns VALUES ('campaign', 'TALES_FROM_THE_LOOP');`);
    await client.query(
      'INSERT INTO character_templates VALUES ($1, $2, 4, $3)',
      [
        '00000000-0000-4000-8000-000000000001',
        'TALES_FROM_THE_LOOP',
        legacySchema,
      ],
    );
    await client.query(`INSERT INTO characters VALUES ('kid', 'campaign', 'player',
      '{"age":12,"type":"BOOKWORM","drive":"Keep my friends safe","broken":true}',
      '00000000-0000-4000-8000-000000000001')`);
  });
  afterEach(async () => {
    await client.query(
      'ROLLBACK; SET search_path TO public; DROP SCHEMA IF EXISTS character_sheet_fixture CASCADE',
    );
    await client.end();
  });

  it('preserves characters and removes only the template relation', async () => {
    const before = (
      await client.query(
        'SELECT "characterId", "campaignId", "ownerId", "data" FROM characters',
      )
    ).rows;
    await client.query(migration);
    expect((await client.query('SELECT * FROM characters')).rows).toEqual(
      before,
    );
    expect(
      (
        await client.query(
          "SELECT to_regclass('character_templates') AS table_name",
        )
      ).rows[0].table_name,
    ).toBeNull();
  });

  it('rolls back when an existing template has custom fields', async () => {
    await client.query(
      `UPDATE character_templates SET "schema" = '{"fields":[]}'`,
    );
    await expect(client.query(migration)).rejects.toThrow(
      'Unsupported character template',
    );
    await client.query('ROLLBACK');
    expect(
      (await client.query('SELECT * FROM characters')).rows[0],
    ).toHaveProperty('templateId');
    expect(
      (await client.query('SELECT * FROM character_templates')).rowCount,
    ).toBe(1);
  });

  it('rolls back when a character template does not match its campaign system', async () => {
    await client.query('UPDATE campaigns SET "system" = NULL');
    await expect(client.query(migration)).rejects.toThrow(
      'Unsupported character template',
    );
    await client.query('ROLLBACK');
    expect(
      (await client.query('SELECT * FROM characters')).rows[0],
    ).toHaveProperty('templateId');
  });

  it('deploys the complete migration chain to an empty database schema without template seeding', async () => {
    await client.query(
      'CREATE SCHEMA character_sheet_fresh; SET search_path TO character_sheet_fresh',
    );
    try {
      const directory = join(process.cwd(), 'prisma/migrations');
      for (const name of readdirSync(directory)
        .filter((name) => /^\d/.test(name))
        .sort()) {
        await client.query(
          // Relocate the historical explicit type qualification to this fixture.
          readFileSync(
            join(directory, name, 'migration.sql'),
            'utf8',
          ).replaceAll('"public".', '"character_sheet_fresh".'),
        );
      }
      expect(
        (await client.query('SELECT count(*)::int AS count FROM game_systems'))
          .rows[0].count,
      ).toBe(1);
      expect(
        (
          await client.query(
            "SELECT to_regclass('character_sheet_fresh.character_templates') AS table_name",
          )
        ).rows[0].table_name,
      ).toBeNull();
      expect(
        (await client.query('SELECT count(*)::int AS count FROM characters'))
          .rows[0].count,
      ).toBe(0);
    } finally {
      await client.query(
        'ROLLBACK; SET search_path TO character_sheet_fixture; DROP SCHEMA IF EXISTS character_sheet_fresh CASCADE',
      );
    }
  });
});
