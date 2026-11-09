---
title: 'Accept Vercel-prefixed Turso variables'
type: 'bugfix'
created: '2026-11-09'
status: 'done'
route: 'one-shot'
---

# Accept Vercel-prefixed Turso variables

## Intent

**Problem:** Vercel injects the connected database credentials as `EXPANDE_DB_TURSO_DATABASE_URL` and `EXPANDE_DB_TURSO_AUTH_TOKEN`, while the server checked only the unprefixed names and incorrectly fell back to Function-local SQLite.

**Approach:** Accept either complete credential pair, prefer the complete standard pair, use the complete Marketplace pair as fallback, and fail closed when only partial remote configuration exists.

## Suggested Review Order

**Credential selection**

- Resolve complete pairs without mixing credentials from different configurations.
  [`remote-store.ts:87`](../server/remote-store.ts#L87)

- Select remote persistence whenever any Turso configuration is present.
  [`app.ts:10`](../server/app.ts#L10)

**Regression protection**

- Cover prefixed startup, precedence, partial pairs, and successful remote health.
  [`remote-store.test.ts:12`](../tests/remote-store.test.ts#L12)

**Operations**

- Document the exact Marketplace names without duplicating protected secrets.
  [`vercel-deployment.md:76`](vercel-deployment.md#L76)

- Record the deployment failure, local evidence, and pending Production check.
  [`verification.md:5`](verification.md#L5)
