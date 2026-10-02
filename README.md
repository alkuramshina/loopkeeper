# Loopkeeper

A web app for running narrative TTRPG campaigns together. The first supported system is **Tales from the Loop**.

The master manages campaign materials and reveals them to players. Players keep their own notes. Everyone can read the investigation board; the master and players add cards, move them and connect them to explore the mystery. Viewers have read access. Board updates currently require a manual refresh.

Backend: NestJS, TypeScript, Prisma and PostgreSQL. Frontend: React, Vite, TanStack Query and React Flow. Images live in private S3-compatible storage and are delivered through the API after checking current access.

Character sheets are implemented in the frontend for each supported game system. The backend validates character data against system rules in code, using the campaign's system. Character requests and responses have no template ID; there is no template table or template endpoint. The seed installs game system reference data only (and an admin account when explicitly enabled).

## Local development

Use Node.js 22+ and Docker. Copy .env.example to .env and set three distinct random secrets (JWT_SECRET, REFRESH_JWT_SECRET and INVITATION_SECRET), each at least 20 characters. For example:

~~~sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
npm install
npm run db:up
npm run prisma:deploy
npm run prisma:seed
npm run start:dev
~~~

The API runs at http://localhost:3000 and Swagger at /docs. Start the frontend in another terminal:

~~~sh
cd frontend
npm install
npm run dev
~~~

Open http://localhost:5173. Set FRONTEND_URL to your frontend origin.

The db:up command starts PostgreSQL, MinIO and provisioning. Provisioning creates a private loopkeeper bucket and a separate runtime user; the API never creates buckets or policies. MinIO's API is on port 9000 and its console on 9001. The initial build compiles pinned upstream MinIO and mc releases because their official registry images are unavailable. Repeated starts reuse the built images.

To start the API in Docker as well:

~~~sh
docker compose --env-file .env -f deploy/docker-compose.yml up --build
~~~

The API waits for migrations and bucket provisioning. Temporary storage failure permits process startup, but readiness fails.

## Media configuration and operations

S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_FORCE_PATH_STYLE (true or false) are required at startup. S3_KEY_PREFIX is optional. Keys in the database are relative; the driver adds the prefix once and lists only its exact prefix/ boundary. An empty prefix uses the entire dedicated environment bucket.

Runtime permissions: GetObject, PutObject and DeleteObject within the application's object scope, ListBucket for that scope, GetBucketLocation, and HeadBucket readiness access. Root credentials are only for provisioning. Use separate credentials, buckets and endpoints for development, tests and production. Keep buckets private and do not publish signed object URLs.

Existing upload routes and /media/:assetId URLs are unchanged. Images retain their normalization and size limits. Missing or inaccessible media returns 404 resource.not_found. Storage failure returns 503 media.storage_unavailable with a safe English message. Cleanup failure after a committed change is logged and does not undo the successful API response.

S3 requests allow two attempts, a 2-second connection timeout, a 10-second request timeout and a 30-second total operation/read timeout. HeadBucket readiness has a 2-second total deadline. /health/live does not contact S3; /health/ready checks both PostgreSQL and storage.

~~~sh
npm run media:reconcile              # report only
npm run media:reconcile -- --apply   # remove confirmed orphans older than one hour
~~~

Reconciliation visits all pages in its configured scope, checks database references again before deleting, and processes deletions sequentially. It also cleans abandoned uploads in the OS temporary directory. Failed deletions are counted and give a nonzero exit code. Listing/database failures stop the run; safe logs record completed work. Retry is safe.

For the one-time transition from disk storage, stop the old API and check MediaAsset rows, managed /media/ references and the previous storage directory/volume. Reset only media that the owner has confirmed can be discarded. Do not reset campaign data and do not automatically delete assets on startup. No migration of old disk objects is provided. An empty installation can simply start with the S3 configuration above.

Production needs independent backups of both PostgreSQL metadata and bucket objects, an off-server copy, and a tested coordinated restore. Bucket lifecycle rules must not delete referenced media. Scheduling reconciliation, production storage configuration and backup/restore verification belong to deployment readiness.

## Tests

~~~sh
npm test
npm run db:test:up
npm run test:e2e
cd frontend
npm test
npm run test:e2e
~~~

Test infrastructure uses loopkeeper_test PostgreSQL and a separate MinIO on port 9002 with the private loopkeeper-test bucket. Each backend/browser run gets a unique tests/ prefix. Cleanup refuses development endpoints, other buckets and empty/unsafe prefixes. Tests use restricted runtime credentials and clean only their own objects. Unit tests use fake storage and do not need MinIO.

Playwright starts its own API on port 3100 and Vite on 5174. Locally it uses installed Google Chrome; no browser download is required. CI builds pinned MinIO/mc sources in both jobs and uses Playwright Chromium. Stop test services with npm run db:test:down.

## Entity views and campaign visits

An entity is new when it is visible, authored by another member and has no view record for that membership. Elements, board cards and links expose isNew; characters are excluded. Fetching or previewing alone does not record a view.

POST /campaigns/:campaignId/views accepts 1?500 entities with entityType (ELEMENT, BOARD_CARD or BOARD_LINK) and entityId. All member roles can record their own views; success returns 204. Inaccessible or foreign entities return 404 views.entity_not_found; nonmembers receive 404 campaign.not_found. The first view timestamp is preserved across repeats. A reference card's view is independent of its source.

The frontend records views after rendering. Board highlights survive technical refetches until manual refresh or leaving. Hiding an element preserves its own views and transactionally removes its reference cards, links and their views. Campaign visits record lastVisitAt without changing views; newVisibleMaterialCount counts visible unviewed materials by others.
