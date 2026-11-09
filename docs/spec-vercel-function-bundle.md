---
title: 'Include the EXPANDE server runtime in the Vercel Function'
type: 'bugfix'
created: '2026-11-09'
status: 'done'
baseline_commit: '1da3170'
context:
  - 'docs/vercel-deployment.md'
  - 'docs/verification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Production returns `500 FUNCTION_INVOCATION_FAILED` because Vercel transpiles `api/index.ts` but omits `/var/task/server/app.ts`; the Function crashes before Fastify can answer `/api/health`.

**Approach:** Explicitly include the non-API runtime source and its read-at-runtime assets in the Vercel Function bundle, while retaining the current API entry point, routing, and Production-only Turso configuration.

## Boundaries & Constraints

**Always:** Include `server/**`, `shared/**`, and the immutable seed package files needed by `server/seed.ts`; retain structured API errors and the existing Node 24 runtime; keep media served as static Vite assets rather than duplicating it in the Function.

**Ask First:** Any change to Production environment variables, Turso data, the Production domain, or the API persistence design.

**Never:** Import or modify Production data during this fix; expose secrets; include `.env`, `.local`, tests, `dist`, or the 76 MB `public/` tree in the Function bundle; replace the API with Function-local SQLite.

## I/O & Edge-Case Matrix

| Scenario                      | Input / State                                    | Expected Output / Behavior                       | Error Handling                      |
| ----------------------------- | ------------------------------------------------ | ------------------------------------------------ | ----------------------------------- |
| Function cold start           | Deployment contains the configured runtime files | `GET /api/health` loads Fastify and returns JSON | No module-not-found startup failure |
| Empty Turso database          | Valid credentials, snapshot not imported         | Health returns `databaseReady: false`            | No import is performed implicitly   |
| Missing required runtime file | Bundle configuration omits an imported/read file | Verification fails before handoff                | Do not proceed to database import   |

</frozen-after-approval>

## Code Map

- `vercel.json` -- Function file inclusion and API/SPA rewrites.
- `api/index.ts` -- Function entry point whose external TypeScript import currently fails.
- `server/app.ts` -- first missing runtime module reported by Vercel.
- `server/seed.ts` -- reads two immutable source-package JSON files at runtime.
- `server/remote-store.ts` -- reads `server/migration.sql` at runtime.

## Tasks & Acceptance

**Execution:**

- [x] `vercel.json` -- add a Function-specific `includeFiles` glob covering server, shared, and required source-package files without bundling public media.
- [x] `server/store.ts`, `server/remote-store.ts` -- replace TypeScript parameter properties with equivalent explicit fields so Node 24 can execute the included source in strip-only mode.
- [x] `docs/vercel-deployment.md`, `docs/verification.md` -- record the startup failure, bundle requirement, local evidence, and pending deployed health check.
- [x] verification -- validate `vercel.json` against Vercel's current schema, run the Node 24 build/tests, and inspect the matched file set for secrets or oversized static assets.

**Acceptance Criteria:**

- Given commit `1da3170` fails because `/var/task/server/app.ts` is absent, when the fix is deployed, then `/api/health` starts without `ERR_MODULE_NOT_FOUND`.
- Given the Production database is still empty, when health succeeds, then it reports `{"ok":true,"databaseReady":false}` without importing data.
- Given public media remain Vite assets, when the Function bundle is built, then it does not duplicate the public video or other static media.

## Spec Change Log

## Design Notes

Use the supported `functions.includeFiles` setting rather than legacy `builds`. The include pattern must be a single Vercel-compatible glob because the current schema accepts one string. Keep the pattern narrowly rooted in runtime directories; Vercel's file tracer already handles npm dependencies.

Vercel transpiles the API entry point but copies `includeFiles` as runtime files. Node 24 can strip erasable TypeScript syntax, but not parameter properties without an additional transform flag; the included server modules therefore use behaviorally equivalent explicit class fields.

## Verification

**Commands:**

- validate `vercel.json` against `https://openapi.vercel.sh/vercel.json` -- expected: schema-valid configuration.
- `npm run build` -- expected: TypeScript and Vite build pass on Node 24.
- `npm test` -- expected: all Node tests pass.
- inspect the include glob matches -- expected: runtime sources/assets included; `.env`, `.local`, `dist`, tests, and `public` excluded.

**Manual checks:**

- After Git/Vercel deployment, `/api/health` returns JSON and runtime logs contain no `ERR_MODULE_NOT_FOUND`.

## Suggested Review Order

**Function bundle boundary**

- Start with the exact runtime glob that repairs the Production cold start.
  [`vercel.json:5`](../vercel.json#L5)

- Confirm the bundle boundary is locked against media, builds, tests, and secrets.
  [`vercel-config.test.ts:5`](../tests/vercel-config.test.ts#L5)

**Node 24 runtime compatibility**

- Review explicit error fields replacing unsupported TypeScript parameter properties.
  [`store.ts:10`](../server/store.ts#L10)

- Confirm the Store path field preserves constructor behavior under native type stripping.
  [`store.ts:62`](../server/store.ts#L62)

- Verify the remote client field uses the same strip-compatible pattern.
  [`remote-store.ts:87`](../server/remote-store.ts#L87)

**Operations and evidence**

- Read why Vercel requires copied runtime sources and keeps media static.
  [`vercel-deployment.md:9`](vercel-deployment.md#L9)

- Inspect the failed deployment evidence and clean local verification results.
  [`verification.md:5`](verification.md#L5)
