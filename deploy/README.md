# Production deployment (L1)

This is a technical deployment for one Linux amd64 server running Docker Engine
and Docker Compose 2.24.4 or newer. It is not a beta release. SMTP/password reset,
off-server database and object backups with a tested coordinated restore,
monitoring, support and legal requirements still gate admission of beta users.

## Images and configuration

CI uses Node 24.21.0 LTS, matching both builds and `.nvmrc`. Frontend versions are
pinned to the existing lockfile. The frontend builds with `VITE_API_URL=/api`;
`VITE_*` is public build configuration, never a place for credentials.

Every PR builds and tests the five application images after backend and frontend
checks. Only successful pushes to `main` publish to GHCR using the job token.
Enable Actions package write access and allow the repository to write its five
packages. Names are `ghcr.io/<owner>/<repository>-{api,frontend,migration,minio,mc}`.
The `deployment-<commit SHA>` Actions artifact contains the compose file,
proxy configuration, operator template and manifest. Keep that artifact outside
Actions retention for each deployed version. It records SHA and all seven image
digests, including pinned Postgres and Caddy. Publication does not deploy or
declare a release. The server needs read-only `read:packages` credentials for
private packages; log in with `docker login ghcr.io --password-stdin`.

Extract the artifact into a version directory, e.g. `/opt/loopkeeper/versions/<sha>`.
Do not build on the server or mix API/frontend/migration commits. Never replace
digests with mutable tags. Maintain the stable Compose project name
`loopkeeper-production`; changing it creates different persistent volumes.

Create `/etc/loopkeeper/production.env` outside the checkout from
`production.env.example`, owned by the operator and mode 600. Fill every blank.
Generate **each** password/secret independently with `openssl rand -hex 32`.
The validator accepts unquoted URL-safe values only, avoiding interpolation and
URL encoding issues in the assembled database URL. Preserve these values across
updates, especially `INVITATION_SECRET` (rotation invalidates invitation links).
Root and runtime MinIO identities and passwords must differ. Do not print
resolved Compose configuration, environment, or container inspection with secrets.

`DOMAIN` is a DNS hostname without scheme/path/port. `TLS_EMAIL` is the operator's
ACME contact. Point DNS A/AAAA records at the server and verify both address
families if advertised. Expose only 80/TCP, 443/TCP and optionally 443/UDP;
restrict SSH to operators. Check existing services, data, port usage and disk
space before installation. API, frontend, PostgreSQL and MinIO have no published
ports. Do not put a CDN/load balancer in front without revisiting forwarding
trust: this configuration assumes exactly one proxy and one external path.

## First installation

Run these commands from the extracted version directory. All steps stop on error;
one-shot operations complete separately from persistent service health waits.
No development database is imported or modified.

```sh
set -eu
config_path=/etc/loopkeeper/production.env
manifest_path="$PWD/manifest.env"
# The CI-generated manifest contains image references, never operator secrets.
set -a
. "$manifest_path"
set +a
docker compose --env-file "$config_path" --env-file "$manifest_path" -f docker-compose.production.yml config --quiet
docker compose --env-file "$config_path" --env-file "$manifest_path" -f docker-compose.production.yml pull api frontend postgres minio proxy
docker pull "$MIGRATION_IMAGE"
docker pull "$MC_IMAGE"
docker run --rm --network none \
  --mount "type=bind,src=$config_path,dst=/checks/production.env,readonly" \
  --mount "type=bind,src=$manifest_path,dst=/checks/manifest.env,readonly" \
  "$MIGRATION_IMAGE" node /checks/validate-environment.mjs /checks/production.env /checks/manifest.env
dc() { docker compose --env-file "$config_path" --env-file "$manifest_path" -f docker-compose.production.yml "$@"; }
dc up -d --wait postgres minio
dc run --rm --no-deps provision
dc run --rm --no-deps migrate
dc run --rm --no-deps bootstrap
dc up -d --wait api frontend proxy
curl --fail --show-error "https://$(sed -n 's/^DOMAIN=//p' "$config_path")/api/health/ready"
```

The migration image has Prisma CLI, schema and migrations from the same commit.
Never generate migrations on the server. Bootstrap upserts only the game system
reference row without overwriting it; `SEED_ADMIN=false` is enforced by compose.
Provisioning creates a private bucket and a separate bucket-scoped runtime user;
repeat provisioning/migration/bootstrap is safe. API receives no root credentials.
PostgreSQL, MinIO, Caddy certificate data and Caddy configuration have independent
persistent named volumes. Never run reset or volume-removal commands here.

The proxy strips `/api` exactly once, including bare `/api`, which returns an API
404. Unknown API paths remain JSON errors. Deep frontend routes use the SPA;
missing assets return 404. Swagger UI/JSON routes are absent in production.
Refresh cookies are HttpOnly, Secure, SameSite=Lax, Path=/, with no Domain.
Caddy overwrites forwarding headers using the peer address; Express trusts one
hop, so spoofed forwarding headers do not change auth throttling. TLS state is
persistent and HTTP redirects to HTTPS. The 12 MiB proxy limit accommodates the
10 MiB map upload and multipart overhead. API rules still enforce actual limits.
Upstream response-header timeout is 60 seconds; S3 operations are capped at 30.
Protected API responses are marked `no-store`; no shared proxy cache is used.

## Domain acceptance

Record the deployed SHA/digests and evidence separately from local smoke:

1. From an external network verify HTTP redirect, valid certificate/hostname and
   `/api/health/ready`. Check unavailable direct API/DB/MinIO/console/frontend ports.
2. Register and log in, create a campaign, invite via link, reveal a material,
   add a board card and cover image, reload the deep route and log out.
3. Two real clients with different public IPs must have independent auth limits;
   varying `X-Forwarded-For` on one client must not reset its five-attempt limit.
4. Verify the operator commands and registry pulls from the actual server.

`frontend/playwright.production.config.ts` runs a browser smoke on an isolated
installation. For a real domain set `PRODUCTION_SMOKE_URL=https://<domain>` with
`SMOKE_INTERNAL_TLS` unset, verifying the real TLS chain. It creates a test account
and campaign; run only on an approved technical installation. Email reset and
invitation delivery join acceptance after P7.

## Update and rollback

Allow a short maintenance window. **Do not update a populated installation**
until the next L slice provides an off-server consistent database/object backup
and a tested coordinated restore. Before then, exercise updates only on isolated
disposable data. Never upgrade Postgres/MinIO or rotate secrets in an ordinary app
update; check their manifest digests against the currently deployed version.

Save the previous bundle/manifest and migration status (`dc run --rm --no-deps
migrate npx prisma migrate status`). Pull the new digests and validate the new
configuration as above. Stop writers (`dc stop api` and any reconciliation jobs)
before the backup and migration. Proxy will return explicit 503 for API requests.
Take the coordinated backup using the verified procedure. From the new bundle,
run `dc run --rm --no-deps migrate` then `dc run --rm --no-deps bootstrap`; only
after both succeed run `dc up -d --wait api frontend proxy`, readiness and smoke.

Migration failure: keep API stopped and preserve logs/migration status, fix the
failed migration using Prisma's documented recovery after reviewing its actual
database state; do not restart automatically. Health or smoke failure: stop the
new API and investigate. The API remains unavailable with 503 during maintenance.
Do not send users to the failed version or improvise a database reset.

Returning to previous API/frontend digests is allowed only after checking their
compatibility with the **current** database schema, including partially applied
migrations. Use the previous bundle with the same project/config and verified
Postgres/MinIO digests, then `dc up -d --wait api frontend proxy` and smoke. Images
do not reverse migrations. If schema compatibility cannot be confirmed, keep
maintenance mode and use the tested joint restore procedure only after an
operator decision specifying restore point and acceptable loss of newer records
and media. No automatic database rollback is provided.

To stop the installation, `dc stop`. To recreate containers use `dc up -d --wait
--force-recreate postgres minio api frontend proxy`; volumes are preserved.

## Reconciliation and isolated verification

```sh
dc exec -T api node dist/media-reconcile.js          # report only
dc exec -T api node dist/media-reconcile.js --apply  # explicit orphan removal
```

Scheduling and backups belong to the next L slice. Runtime reconciliation needs
no TypeScript, source tree or Prisma CLI.

From a development checkout with Docker, `node deploy/build-images.mjs` builds
all images; `node deploy/test-production.mjs` tests a randomly named isolated
production project using generated credentials, private storage and internal
TLS. It uses only images at runtime. It checks repeat provisioning/migrations/
bootstrap, routing, cookies, access matrix, near-limit uploads, client IP spoofing,
readiness outages and data persistence across recreation. It deletes only that
random test project's volumes. `SMOKE_KEEP=true` retains the isolated stack for
the production Playwright test; its temporary environment path and project name
are printed, not credential values. Do not use this option on a real deployment.
