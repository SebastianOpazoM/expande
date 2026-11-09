# Vercel deployment

## Current status

**Do not deploy the repository to Vercel as-is.** The frontend and committed media are compatible with Vercel, but the application database is not. The current server opens `DATABASE_PATH` with Node's `node:sqlite`, writes visitor sessions to that file, and expects those writes to survive restarts. Vercel Functions do not provide a shared persistent local filesystem, so changing `DATABASE_PATH` to a path inside a Function would eventually lose data or give concurrent instances different data.

This guide is the deployment plan and acceptance checklist. It intentionally does not include a premature `vercel.json`: adding routing alone would produce a deployment whose persistence contract is false.

Vercel's current platform documentation is explicit that local SQLite is unsupported for durable writes:

- [Is SQLite supported in Vercel?](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Vercel Functions lifecycle](https://vercel.com/docs/functions)
- [Storage integrations](https://vercel.com/docs/marketplace-storage)

If the app must go online without a storage migration, use the existing [single-host Docker deployment](deployment.md). It preserves the current SQLite behavior and is the lowest-risk route.

## What is already portable

| Item | Repository source | Current size | Vercel plan |
| --- | --- | ---: | --- |
| React/Vite frontend | `src/`, `index.html` | Build output varies | Build with `npm run build` and serve `dist/` |
| Images and brand assets | `public/images`, `public/brands` | About 4.8 MB | Vite copies them to `dist/`; serve as immutable static assets |
| Recap video | `public/videos/expande-masterclass-resumen-jornada.mp4` | About 71 MB | Vite copies it to `dist/videos`; verify range playback after deploy |
| Enriched demo snapshot | `demo/expande.sqlite` | About 1.6 MB | Import once into the managed database; never use it as a writable Function-local file |
| Original source package | `source-package/` | About 380 KB | Preserve it in the repository; it does not need a public route |

The complete `public/` directory is about 76 MB. That currently fits below Vercel's documented 100 MB Hobby CLI source-upload limit, but with limited headroom. See [Vercel limits](https://vercel.com/docs/limits). If deployment size or video transfer becomes a problem, move only the MP4 to object storage such as Vercel Blob and update its catalog URL through the audited data CLI. Do not silently replace or recompress the source media; preserve its provenance and hash in the media documentation.

No upload feature is needed. The demo's documents remain metadata-only, and its media are versioned, read-only deployment assets.

## Required target architecture

The smallest Vercel-compatible design is:

1. Vercel builds the Vite frontend and serves `dist/` and its media through the CDN.
2. The Fastify API runs as a Node.js Vercel Function.
3. A managed SQLite-compatible service, recommended here as Turso Cloud, owns all durable records and visitor sessions.
4. Production and Preview deployments use separate databases. Preview deployments must never write to the production demo database.
5. The browser continues to call same-origin `/api/...`; no public administrative API or real authentication is introduced.

Turso is available through the [Vercel Marketplace](https://vercel.com/marketplace/tursocloud/database) and provides `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. It is a close data-model match, but it is **not** a drop-in configuration change for this repository: its JavaScript client is asynchronous while the current `Store` and action layer use the synchronous `DatabaseSync` API.

## Implementation work required before deployment

Treat the following as one code change and verify it locally before connecting production resources:

- Introduce a storage interface used by `server/store.ts`, `server/actions.ts`, `server/app.ts`, and the data CLI.
- Keep the local `node:sqlite` adapter for local development, Docker, tests, backups, and recovery.
- Add an asynchronous Turso/libSQL adapter for Vercel. Preserve transactions, foreign keys, revision conflicts, relationship rebuilding, audit history, schema validation, session isolation, and the existing migration table.
- Convert affected server/action call sites to `async` without weakening validation or ownership checks.
- Make the Fastify app available at a Vercel-recognized entry point and keep process listening limited to local/Docker startup. The API entry point must reuse `createApp` rather than duplicate routes.
- Add Vercel routing so `/api/*` reaches Fastify and all non-file SPA routes fall back to `dist/index.html`. The SPA fallback must not swallow API 404 responses.
- Make `npm run data -- ...` select the same remote database when Turso variables are present, or add a clearly named remote administrative command. The preview/apply/revision/history workflow must remain intact.
- Add tests against the remote adapter or a compatible local libSQL server, including concurrent revision conflicts and two independent visitor sessions.
- Keep `demo/expande.sqlite` immutable. It is an import source, not the production database.

Do not use Vercel Blob as if it were a mounted SQLite disk. Object storage can hold a backup object, but it does not provide SQLite locking, transactions, or shared live-file semantics.

## Database import and environment setup

Perform these steps only after the remote adapter passes the normal build and test suite.

1. Back up the intended source database. For the committed enriched demo, use `demo/expande.sqlite`. For a newer local runtime database, use the existing `npm run data -- backup` command first.
2. Run an integrity check and record counts locally. Preserve the backup outside the repository.
3. Provision separate Turso databases for Production and Preview. Choose a database region close to the Vercel Function region.
4. Import the SQLite snapshot. Turso documents `turso db import /path/to/database.sqlite` for an existing SQLite file; follow its current import instructions and verify the schema, `migrations`, `scopes`, `records`, and `audit` tables after import.
5. Connect the Turso integration to the Vercel project, scoped to the correct environments.
6. Set these Vercel environment variables:

   | Variable | Environments | Value |
   | --- | --- | --- |
   | `TURSO_DATABASE_URL` | Production, Preview | Different database URL per environment |
   | `TURSO_AUTH_TOKEN` | Production, Preview | Secret token for the matching database |
   | `DEMO_ACCESS_PASSWORD` | Production, Preview | Strong shared demo-gate password |
   | `COOKIE_SECRET` | Production, Preview | Independent random value of at least 32 characters |
   | `COOKIE_SECURE` | Production, Preview | `true` |
   | `TRUST_PROXY` | Production, Preview | `true` after proxy-address behavior is verified |

   Do not set `DATABASE_PATH` in Vercel. Do not expose Turso credentials with a `VITE_` prefix; that prefix would place them in browser code.

7. Select Node.js 24.x in Vercel. It is compatible with the repository's current Node requirement and is currently supported by Vercel.

The current Turso import reference is [Migrating and importing SQLite](https://turso.tech/blog/migrating-and-importing-sqlite-to-turso-just-got-easier). Recheck the provider's current command before operating on production.

## Deploy

After the Vercel adapter, entry point, and routing configuration have been merged:

```text
npm ci
npm run build
npm test
npm run test:e2e
npx vercel
```

Use the Preview URL for acceptance checks. Promote only a deployment that passes the checklist below. A Git-connected Vercel project may replace the final CLI command with its normal Preview/Production promotion flow.

## Acceptance checklist

- `/api/health` returns HTTP 200.
- A deep link such as `/desafios` renders instead of returning 404.
- The access gate sets Secure, HttpOnly cookies and survives a new request.
- A new browser receives a unique session UUID under Cuenta → Cambiar escenario.
- Two browsers receive different session UUIDs and cannot see each other's private activity.
- Saved items, form changes, training progress, and drafts survive reloads, idle scale-to-zero, and a new deployment.
- A revision conflict still returns HTTP 409 instead of overwriting newer data.
- Catalog edits made through the remote-aware data CLI appear in the app and create audit entries.
- Session reset preserves catalog changes.
- All images, logos, and local fonts return HTTP 200.
- The recap MP4 returns HTTP 206 for a byte-range request and plays/seeks on mobile Safari and Chromium.
- Preview activity does not change Production records.
- Runtime logs do not contain cookies, passwords, database tokens, record bodies, or document metadata.
- A managed-database backup/export and restore rehearsal has been completed and documented.

After verification, add the actual Vercel results and any limits to [verification.md](verification.md). Do not claim full live-Figma fidelity; the existing limits in the interaction inventory and discrepancies documents still apply.

## Rollback

Application rollback and data rollback are separate operations:

- Use Vercel's deployment rollback for a bad application release.
- Use the managed database provider's recovery mechanism or a verified export/import for damaged data.
- Never point an older application release at a newer, incompatible schema without a documented compatibility check.
- Keep the last known-good database export outside Vercel and outside the Git repository.

