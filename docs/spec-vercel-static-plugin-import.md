---
title: 'Keep the local static plugin out of the Vercel API startup path'
type: 'bugfix'
created: '2026-11-09'
status: 'done'
baseline_commit: '359b2bb'
context:
  - 'docs/vercel-deployment.md'
  - 'docs/verification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Deployment `dpl_G8y2HKT8VDRwTznaMRVRXLp4KwA1` contains the previously missing server runtime, but its Function now fails during module initialization because `server/app.ts` eagerly loads `@fastify/static`. Vercel's generated CommonJS startup wrapper cannot require that plugin's ESM-only `content-disposition` dependency, even though the Function sets `serveStatic: false` and never needs the plugin.

**Approach:** Load `@fastify/static` only inside the existing local static-serving branch. Preserve the current API routes, Vercel entry point, local/Docker SPA fallback, media packaging, and Turso behavior.

## Boundaries & Constraints

**Always:** Keep public media in the Vite static deployment; keep local and Docker serving of `dist` functional; retain structured API behavior and the Production-only Turso configuration.

**Ask First:** Any change to Production environment variables, Turso data, the Production domain, dependencies, or the persistence design.

**Never:** Import or modify Production data; expose secrets; downgrade security-fixed packages; serve public media through the Function; remove local SPA fallback behavior.

## I/O & Edge-Case Matrix

| Scenario                  | Input / State                                          | Expected Output / Behavior                                               | Error Handling                                              |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Vercel cold start         | `createApp(..., { serveStatic: false })`               | API starts without evaluating `@fastify/static`                          | API handler retains its structured startup failure response |
| Local built app           | `dist/index.html` exists and static serving is enabled | Plugin loads, assets are served, and non-API routes fall back to the SPA | Unknown API routes still return structured JSON 404         |
| Development without build | `dist/index.html` is absent                            | Static plugin is not loaded                                              | API server remains available                                |

</frozen-after-approval>

## Code Map

- `server/app.ts` -- shared Fastify factory whose top-level static-plugin import crashes the Vercel Function.
- `api/index.ts` -- Vercel entry point that explicitly disables static serving.
- `server/index.ts` -- local/Docker entry point that keeps static serving enabled.
- `tests/api.test.ts` -- API factory coverage for non-static operation.
- `tests/e2e/` -- browser coverage that exercises the locally served production build.
- `docs/vercel-deployment.md`, `docs/verification.md` -- deployment instructions and production evidence.

## Tasks & Acceptance

**Execution:**

- [x] `server/app.ts` -- replace the eager static-plugin import with a conditional dynamic import inside the existing built-SPA branch.
- [x] `tests/api.test.ts` -- retain or add coverage for API startup with static serving disabled and structured health behavior.
- [x] `docs/vercel-deployment.md`, `docs/verification.md` -- record the second startup failure, its cause, the fix, and the remaining deployed health check.
- [x] verification -- build, run Node tests and browser tests, inspect the diff, and confirm the Production database remains untouched.

**Acceptance Criteria:**

- Given a Vercel Function starts with `serveStatic: false`, when it initializes the shared app, then `@fastify/static` and its ESM dependency are not evaluated.
- Given the production frontend has been built locally, when the standalone server starts, then it still serves the SPA and its static media.
- Given an API route is unknown in either mode, when it is requested, then the response remains a structured JSON 404 rather than the SPA document.

## Spec Change Log

## Design Notes

Keep the import in the same condition that already controls registration. This removes the unused dependency from Vercel's executed startup path without changing package versions or separating the shared application factory.

## Verification

**Commands:**

- `npm run build` -- expected: TypeScript and Vite production build pass.
- `npm test` -- expected: all Node tests pass.
- `npm run test:e2e` -- expected: the built SPA, API, and static assets work through the local Fastify server.
- `npm audit` -- expected: no known vulnerabilities.
- `git diff --check` -- expected: no whitespace errors.

**Manual checks:**

- After the user pushes and Vercel reports Ready, open `/api/health`; expect JSON and no `ERR_REQUIRE_ESM` in Runtime Logs.

## Suggested Review Order

**Function startup boundary**

- Load the static plugin only for the local built-SPA branch.
  [`app.ts:153`](../server/app.ts#L153)

- Explain why Vercel deliberately bypasses local static serving.
  [`vercel-deployment.md:11`](vercel-deployment.md#L11)

**Regression protection**

- Exercise the Vercel-shaped non-static startup in an isolated Node process.
  [`api.test.ts:6`](../tests/api.test.ts#L6)

- Fail immediately if startup resolves the forbidden static plugin.
  [`vercel-no-static-load.ts:7`](../tests/fixtures/vercel-no-static-load.ts#L7)

**Operational evidence**

- Record the Production failure, local checks, and pending deployed health check.
  [`verification.md:5`](verification.md#L5)
