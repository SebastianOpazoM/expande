# EXPANDE · persistent mobile demo

Local React/TypeScript mobile prototype with a Fastify API, SQLite persistence, isolated visitor sessions and a validated data-editing CLI. Spanish UI and original EXPANDE data package are included. No service is deployed by this repository.

## Run locally

Requires Node **22.18+** (Node 24 recommended) and npm.

```powershell
npm install
New-Item -ItemType Directory -Force data
Copy-Item demo/expande.sqlite data/expande.sqlite
npm run dev
```

Open **http://127.0.0.1:5173**. Choose “Explorar demo” and a simulated profile. No real credentials are requested. Account → “Cambiar escenario” exposes the session UUID, demo clock, UI state simulations, profile/role switcher and session reset.

For a fresh checkout, the commands above copy the included demo snapshot to the runtime database. This snapshot includes the enriched catalogues, demo visitor activity and audit history as of 2026-11-09. Copy it only when setting up a new working database; preserve an existing runtime database. Without the copy, SQLite initializes automatically from the original seed at `data/expande.sqlite`. It survives reloads and server restarts. Use the same hostname consistently: `localhost` and `127.0.0.1` have different browser cookies. New browsers have independent progress. A persistent cookie identifies a visit; clearing it starts a new visit. The cookie is valid for one year.

For a production-style local preview:

```powershell
npm run build
npm start
```

Open http://127.0.0.1:3001. Native local development has no access gate unless `DEMO_ACCESS_PASSWORD` is set. Docker requires the gate password and signing secret.

Copy `.env.example` to `.env` when using Docker. Node scripts load `.env` through the start/dev/data scripts. Environment variables take precedence. Never commit `.env`, runtime databases, private backups or secrets. The explicitly included `demo/expande.sqlite` is a portable demo snapshot produced through `npm run data -- backup`; active database files and their WAL/SHM sidecars remain ignored. All catalogue media, including the original recap video in `public/videos`, are included in this repository.

## Modify data using prompts

Ask an agent working in this repository, for example:

> Change the title of CH-D01 in the shared catalog to “Monitoreo estructural remoto”. Preserve its ID and all other fields. Preview and apply the change through the data CLI.

> In visitor session `<UUID>`, update APP-03 to “en_revision” at “pertinencia”, with a manual history note. Keep the evaluator-controlled applications unchanged.

> Show my audit history and restore the last catalog edit if nothing has changed since.

See [agent data guide](docs/agent-data.md). No in-app AI, provider key or model subscription is required. Agents execute the local CLI; the deployed browser does not expose an administrative data API.

## Data layout

`catalog` stores shared public content. `templates` stores starter organizations and activity for new sessions. A session UUID stores a visitor's own organizations, users, drafts, documents, saved items, preferences, notifications and progress. Public questions added in a demo are private to that visitor session.

Catalog changes appear in every session; template changes affect new or explicitly reset sessions. Existing company/activity records require targeting that session. The demo clock starts at **2026-11-06 12:00 America/Santiago** and is independent per session. Audit timestamps use actual time.

The challenge catalogue starts with **Todos los estados**, including the five documentary challenges CH-R01–CH-R05 alongside the simulated examples. Explicit state filters remain available; home recommendations still show open challenges. Each documentary detail links to its original PDF under **Fuente y documentos**, with an external exit confirmation. Current availability remains unverified.

The five briefs were used to enrich the local `data/expande.sqlite` catalogue on 2026-11-08, through a revision-checked CLI preview/apply batch (`cda7a175-3c76-46b3-a46a-5a6c5959a79e`). This is a runtime data update: a fresh database or explicit catalogue restoration starts from the immutable original package. The reviewed batch and before/after evidence are in `.local/catalogue-enrichment.json`, `.local/catalogue-preview.json` and `.local/catalogue-applied.json` on this workspace. To move the update to another database, read its current records/revisions and reconcile a new batch before preview/apply; do not reuse old expected revisions blindly. ABC Dust.pdf was excluded.

The SQLite schema uses indexed relational ownership fields, FK-backed relationship records, and validated JSON payloads to preserve the supplied data contract. Writes are transactional. Revision checks prevent stale updates. Simulated documents store metadata only, never file contents.

## Checks

The enriched training catalogue has 12 illustrated cards with source-based demo lessons. Content, artwork prompts, the catalogue update procedure and verification are documented in [Formación library](docs/formacion-library.md). Its runtime catalogue update is separate from the immutable original seed.

```powershell
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Browser tests use a separate `.local/e2e.sqlite` database and exercise the built app at port 3099. Screenshots are written to `.local/screenshots`. See [verification](docs/verification.md) for actual results and limits.

The data CLI, database initialization and unit tests use Node's native TypeScript transformation, as the browser-test server already does. This avoids the `tsx` loader's `os.userInfo` failure in restricted Windows accounts; Node may print experimental-feature warnings.

## Server deployment later

See [deployment guide](docs/deployment.md) for Docker Compose, HTTPS reverse proxy, backups, recovery and updates. Deploy a **single instance** with a persistent SQLite volume. This is a private demonstration with simulated profiles, not production multi-user authentication.

For a Vercel target, use the separate [Vercel deployment plan](docs/vercel-deployment.md). Static media, including the local recap video, can be included in the Vite deployment; the current writable `node:sqlite` database cannot. The plan documents the required managed-database adapter, snapshot import, environment separation and deployment acceptance checks. Do not deploy the current repository to Vercel and treat Function-local SQLite as durable storage.

The [interaction inventory](docs/interaction-inventory.md) distinguishes live-inspected screens from specification-derived behavior. [Discrepancies](docs/discrepancies.md) record the source-access limitation. Original documents, seed JSON, schema and acceptance tests remain unchanged in `source-package/Expande_paquete_para_Figma`.
