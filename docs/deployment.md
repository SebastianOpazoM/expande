# Private server deployment

This page covers the current, production-ready storage model: one Docker host with a persistent SQLite volume. If Vercel is mandatory, read the [Vercel deployment plan](vercel-deployment.md) first. The frontend media can be hosted there, but the writable SQLite store must be migrated to a managed database before deployment.

The image serves the built React frontend and Fastify API from one Node 24 process. SQLite uses WAL and a persistent volume. Run one app instance on one host; do not place SQLite on a network filesystem or scale replicas.

## Prepare and start

```text
cp .env.example .env
```

Set a strong `DEMO_ACCESS_PASSWORD`, an independent random `COOKIE_SECRET` of at least 32 characters, and `COOKIE_SECURE=true` for HTTPS. On a local HTTP-only Docker check use `COOKIE_SECURE=false`. Do not publish secrets or use example values on a server.

```text
docker compose up -d --build
docker compose ps
```

The container binds to host loopback at `127.0.0.1:3001`. The shared password gate opens the private demo; simulated profiles remain selectable within each visitor's own session. This is not real identity-based authorization. The app validates provider roles inside each demo, but a visitor may deliberately switch their own demo profile.

## HTTPS reverse proxy

Point a domain to the host and configure an HTTPS reverse proxy. Example Caddy configuration:

```caddyfile
demo.example.com {
    reverse_proxy 127.0.0.1:3001
}
```

Caddy manages certificates. Preserve the original Host and Origin headers. Configure `TRUST_PROXY=true` only when the application is reachable exclusively through the trusted proxy; this supports accurate rate-limit addresses. Keep the application port on loopback. Set `COOKIE_SECURE=true`, then recreate the app container. The application rejects cross-origin JSON mutations and has no CORS-enabled administrative API.

## Backups

```text
docker compose exec app npm run data -- backup --output /app/backups/expande-before-update.sqlite
```

Use a new filename for each snapshot. Copy snapshots off the host regularly. Retain `.env` secrets separately so cookies remain valid after restarts. Do not commit databases/backups.

The image can be used as an administrative one-off service while the web process is stopped:

```text
docker compose stop app
docker compose run --rm --no-deps app npm run data -- restore-backup --file /app/backups/expande-before-update.sqlite --confirm
docker compose up -d app
```

Restore verifies integrity/schema, restores within a transaction and increments revisions. Restore affects every visitor and catalog record; it is distinct from resetting a single visitor. For an ordinary edit use audited CLI batches and per-batch restoration.

## Update and migrations

Back up first, pull the intended repository commit, and run `docker compose up -d --build`. Schema migrations run on startup and are recorded in `migrations`; the initial migration is `server/migration.sql`. Future schema changes must add a new numbered migration and a forward/backward recovery note. Avoid rolling back application code onto an incompatible newer database; restore the corresponding snapshot instead.

Check `/api/health` and container logs after an update. The health endpoint reveals no demo records. Logs report requests/status, not bodies or cookies. Keep log retention bounded on the host.

No deployment is performed as part of local implementation. Cloudflare/Sites hosting is not used because this version intentionally uses an ordinary persistent SQLite file and a single Node server.
