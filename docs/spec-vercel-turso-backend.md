---
title: 'Run the persistent EXPANDE demo on Vercel with Turso'
type: 'feature'
created: '2026-11-09'
status: 'done'
baseline_commit: '5e639cd9c3be9ba3572c08b0bad236b2e7dd4ce7'
context:
  - 'docs/vercel-deployment.md'
  - 'docs/agent-data.md'
  - 'docs/verification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Vercel currently deploys only the Vite frontend, so every `/api/*` request returns an HTML 404. The existing synchronous `node:sqlite` database cannot provide durable shared state inside Vercel Functions.

**Approach:** Add a server-side Turso/libSQL persistence path and a Vercel Fastify entry point while retaining local SQLite for development, tests, Docker, backups, and recovery. Migrate the reviewed demo snapshot only after the remote adapter passes local and Preview verification.

## Boundaries & Constraints

**Always:** Preserve schema validation, ownership/role checks, foreign-key relationships, revision conflicts, transactions, audit history, visitor isolation, catalog/template semantics, the shared access gate, same-origin mutation checks, and the immutable source package. Keep all Turso credentials server-side. Preserve `npm run data -- ...` for local SQLite and provide an equally explicit revision-checked route for remote administration.

**Ask First:** Any destructive or irreversible operation against `database-teal-xylophone`; replacing or clearing an existing remote database; importing the snapshot into Production; changing the Production deployment or domain; weakening a validation/transaction invariant because of provider limitations.

**Never:** Treat Function-local storage or Vercel Blob as the live SQLite database; expose secrets through `VITE_*`; silently share Production data with Preview; add real authentication, uploads, payments, notifications, submissions, or edit the immutable original seed/source package.

## I/O & Edge-Case Matrix

| Scenario               | Input / State                                 | Expected Output / Behavior                             | Error Handling                                            |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| First Production visit | Valid Turso credentials, no session cookie    | Create one durable session and return bootstrap JSON   | Return structured JSON; never fall through to SPA HTML    |
| Returning visitor      | Valid signed cookie after cold start/redeploy | Load the same session and saved activity               | Missing/invalid session creates a new isolated session    |
| Concurrent edit        | Two writes use the same record revision       | Exactly one succeeds                                   | Stale write returns HTTP 409                              |
| Database unavailable   | Turso timeout or invalid credential           | API fails without leaking credentials or record bodies | Structured 5xx JSON and safe user-facing message          |
| Non-API deep link      | `/desafios/:id`                               | Serve the Vite SPA                                     | API routes are excluded from SPA fallback                 |
| Production import      | Reviewed SQLite snapshot and non-empty target | Refuse by default                                      | Require an explicit, separately approved replacement path |

</frozen-after-approval>

## Code Map

- `server/store.ts` -- synchronous SQLite domain store and invariants that the remote path must preserve.
- `server/actions.ts` -- role-aware mutations and revision-controlled batches.
- `server/app.ts` -- Fastify routes, access gate, cookies, same-origin checks, and current direct SQLite access.
- `server/cli.ts` -- audited local data administration, backup, restore, and export behavior.
- `server/migration.sql` -- authoritative relational schema and migration record.
- `demo/expande.sqlite` -- reviewed import source; never a writable Function-local database.
- `src/context.tsx` -- API client that currently assumes every response is JSON.
- `package.json` -- runtime/dependency configuration.
- `docs/vercel-deployment.md` -- operational runbook and acceptance checklist.

## Tasks & Acceptance

**Execution:**

- [x] `package.json`, `package-lock.json` -- add the supported Turso/libSQL client and pin Node 24.x for deterministic Vercel builds.
- [x] `server/store.ts`, new server persistence modules -- introduce an asynchronous storage contract with local SQLite and Turso implementations; preserve domain behavior and atomic revision checks.
- [x] `server/actions.ts`, `server/app.ts` -- run existing actions inside the asynchronous adapter transaction, isolate direct local database access, and keep errors as structured JSON.
- [x] `server/cli.ts`, import tooling -- retain local backup/restore and add explicit remote read/preview/apply/history/import workflows with non-empty-target protection.
- [x] Vercel entry point and configuration -- route `/api/*` to Fastify and SPA deep links to `dist/index.html` without exposing server files.
- [x] `src/context.tsx` -- handle HTML/non-JSON and unavailable-API responses with a clear Spanish message.
- [x] `tests/` -- cover local compatibility, remote adapter behavior, cold-start persistence, isolation, conflicts, API 404 behavior, and import refusal.
- [x] `docs/vercel-deployment.md`, `docs/verification.md` -- record exact setup, import procedure, executed evidence, and remaining limitations.

**Acceptance Criteria:**

- Given a Vercel deployment connected to Turso, when a visitor uses the demo across reloads and redeploys, then their isolated session and mutations persist.
- Given local development or Docker without Turso variables, when existing commands and tests run, then the SQLite workflow remains compatible.
- Given any `/api/*` failure, when the browser receives the response, then it gets structured JSON or a safe Spanish connectivity message rather than an HTML parsing exception.
- Given the reviewed Production database is empty and the adapter is verified, when the separately approved import runs, then schema, scopes, records, audit history, and integrity checks match the source snapshot.

## Spec Change Log

## Design Notes

Use one domain-level asynchronous contract rather than duplicating business rules for Turso. Local SQLite may adapt synchronous operations behind resolved promises, while the remote implementation uses libSQL transactions/batches. Keep provider-specific SQL and credentials below the store boundary so the app and action rules remain shared.

Production-only credentials are already configured in Vercel. Preview intentionally has no database credentials; remote verification should use a separate disposable test database or local compatible service and must not connect previews to Production.

## Verification

**Commands:**

- `npm ci && npm run build` -- TypeScript and Vite production build pass on Node 24.
- `npm test` -- local domain, API, CLI, catalog, location, and new adapter tests pass.
- `npm run test:e2e` -- browser flows pass against the built application.
- `vercel build` -- Vercel routing and Function bundle build locally without Production secrets.

**Manual checks:**

- Verify `/api/health`, access cookies, two-browser isolation, persistence across a redeploy, media byte ranges, Production-only environment scope, and backup/export recovery before promotion.

## Suggested Review Order

**Runtime boundary**

- Start where local SQLite and remote Turso are selected without duplicating routes.
  [`app.ts:10`](../server/app.ts#L10)

- Follow the Vercel Function adapter and its structured startup failure response.
  [`index.ts:8`](../api/index.ts#L8)

- Confirm API and SPA requests remain separated by explicit rewrites.
  [`vercel.json:3`](../vercel.json#L3)

**Persistence and safety**

- Review serialized remote transactions reusing the established synchronous domain store.
  [`remote-store.ts:142`](../server/remote-store.ts#L142)

- Check guarded snapshot import and non-empty-target refusal before Production use.
  [`remote-store.ts:173`](../server/remote-store.ts#L173)

- Inspect the local snapshot contract shared with the remote adapter.
  [`store.ts:577`](../server/store.ts#L577)

- Verify remote administration keeps explicit scopes, revisions, preview, audit, and actions.
  [`remote-cli.ts:19`](../server/remote-cli.ts#L19)

**User-facing resilience**

- Confirm HTML and malformed responses become safe Spanish connectivity messages.
  [`context.tsx:15`](../src/context.tsx#L15)

**Verification and operations**

- Review persistence, isolation, conflict, import, and cold-start API coverage.
  [`remote-store.test.ts:12`](../tests/remote-store.test.ts#L12)

- Inspect the Production-only Vercel setup and staged import runbook.
  [`vercel-deployment.md:1`](vercel-deployment.md#L1)

- Read executed evidence and explicit remaining deployment checks.
  [`verification.md:5`](verification.md#L5)
