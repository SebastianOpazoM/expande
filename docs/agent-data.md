# Agent data interface

Run commands from the repo root. Output is JSON. `npm run data -- help` lists commands. No privileged API is remotely exposed.

## Discover and target

```powershell
npm run data -- collections
npm run data -- schema --collection challenges
npm run data -- list --scope catalog --collection challenges --search rastras
npm run data -- get --scope catalog --collection challenges --id CH-D01
npm run data -- sessions
npm run data -- list --scope <SESSION_UUID> --collection applications
```

Use `catalog` for public content; `templates` for new visitors; exact session UUID for existing visitor data. The browser's scenario page shows its UUID. Do not select a session just because it is the most recent.

## Preview and apply an atomic batch

Create a file under ignored `.local/` containing an array:

```json
[
  {
    "collection": "challenges",
    "id": "CH-D01",
    "expectedRevision": 1,
    "value": { "id": "CH-D01", "title": "... complete record from get, with desired edits ..." }
  }
]
```

`value` must contain the **complete original record**. The abbreviated example above is not a valid challenge. Preserve unknown values, documentary provenance and IDs. `_rev` may be omitted from `value`; it is storage metadata and is always stripped. Set `expectedRevision` to the value read from `_rev`. New records use 0. Delete uses `value: null`; referenced records cannot be deleted without updating their relationships in the same transaction.

```powershell
npm run data -- preview --scope catalog --file .local/changes.json
npm run data -- apply --scope catalog --file .local/changes.json --actor codex
npm run data -- history --scope catalog
npm run data -- restore --batch <BATCH_UUID> --actor codex
```

Preview validates and rolls back all changes and audit entries. Apply validates the whole batch and commits once. A stale revision, invalid schema, broken reference, cross-company application team or inconsistent application history rejects the batch. Restore refuses when the current record revision differs from the recorded after-revision. Restore is itself audited.

## Domain actions

Application state changes must create a matching history event. Use an action file:

```json
{
  "type": "application_status",
  "id": "APP-03",
  "revision": 1,
  "state": "en_revision",
  "pipeline_stage": "pertinencia",
  "result": "pendiente",
  "note": "Seguimiento actualizado por la empresa en la demo."
}
```

```powershell
npm run data -- action --scope <SESSION_UUID> --file .local/action.json --actor codex
npm run data -- clock --scope <SESSION_UUID> --now 2026-11-10T12:00:00-03:00
```

Actions use that session's selected simulated profile and enforce its role. To make an administrative data correction that exceeds provider permissions, use a batch with all related records/events updated consistently. `clock --scope templates` changes the clock for future/reset visits; existing sessions are unchanged. Clock edits are audited but use another explicit clock command to undo rather than batch restoration.

## Export, backup and recovery

```powershell
npm run data -- export --scope catalog --output .local/catalog.json
npm run data -- export --scope <SESSION_UUID> --output .local/visitor.json
npm run data -- backup --output backups/before-edit.sqlite
npm run data -- reset --scope <SESSION_UUID> --confirm
```

Create the destination backup directory first. Backups use SQLite `VACUUM INTO`, which produces a consistent live snapshot. Full database restore requires stopping the application and using `restore-backup --file ... --confirm`; do not replace a live SQLite file or copy only the main file while WAL writes are active.

In Docker prefix commands with `docker compose exec app`, for example:

```text
docker compose exec app npm run data -- sessions
docker compose exec app npm run data -- backup --output /app/backups/before-edit.sqlite
```

Transfer a prepared JSON changes file into the container with `docker compose cp` when needed. Backups contain visitor data and are not repository artifacts.

## Remote Turso administration

`npm run data:remote -- help` works without credentials. Every command that connects requires `.env` to contain authorized server-side `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` values for the intended environment. The remote CLI supports status, sessions, history, list, get, preview, apply, action and restore while reusing the same schema, ownership, relationship, audit and revision checks as the local store.

The one-time import command refuses any remote database that already contains scopes:

```text
npm run data:remote -- status
npm run data:remote -- import --file demo/expande.sqlite --confirm-empty
```

Import is not an ordinary edit. Confirm the exact Vercel environment/resource and obtain explicit approval before running it. Provider backups/exports remain separate from the local SQLite `backup` and `restore-backup` commands.
