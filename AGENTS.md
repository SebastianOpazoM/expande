# Working on EXPANDE

This is a Spanish-language, simulated mobile demo. Preserve the source package and provenance labels. No real authentication, notifications, documents, payments or submissions should be added without a new user request.

## Editing actual demo data from prompts

Use `npm run data -- help`. Use the same database as the app (`DATABASE_PATH`, default `./data/expande.sqlite`). In Docker, run `docker compose exec app npm run data -- ...`.

1. Discover `collections` and `schema --collection <name>`.
2. Choose an explicit scope: `catalog` for shared challenges/resources, `templates` for new visitors, or a session UUID from `sessions` for existing visitor activity. Never guess which visitor to edit. The UI shows its UUID under Cuenta → Cambiar escenario.
3. Read the record with `get --scope ... --collection ... --id ...`. `_rev` is its current revision.
4. Prepare a JSON array of changes with `collection`, `id`, `value` (full record, or null to delete), and `expectedRevision` (current `_rev`, or 0 to create). Do not change IDs.
5. Run `preview --scope ... --file ...`, inspect the validated diff, then `apply` the same file to perform the requested edit. Explicit user requests to edit data authorize ordinary edits; do not add an extra approval workflow.
6. For changes that have domain side effects (e.g. an application status change), use `action --scope SESSION --file ...`; it creates the required history event. The action runs as the session's selected demo profile and enforces its role. Administrative batches can edit all records but still enforce schema and references.
7. Check the result and audit history. The visible app refreshes shared/session data within about three seconds. Existing forms preserve unsaved input; a conflict requires reloading and reconciling before retrying.

Use `history`, `restore --batch ...`, `backup`, and `export` for review and recovery. Normal edits must not use raw SQL, replace the whole database, or edit the immutable original seed package. A session reset preserves catalog changes. Catalog restoration and database restoration are separate explicit operations.

## Development and verification

- `npm run dev` starts Vite at 5173 and the API at 3001.
- `npm run build`, `npm test`, and `npm run test:e2e` are the checks. Build before browser tests.
- SQLite is authoritative; browser storage is for presentation state only.
- API input must pass ownership/role, schema, relationship and revision checks. API and CLI share `server/actions.ts` and `server/store.ts`.
- Do not spawn sub-agents unless the user explicitly requests delegation.
- Check `docs/interaction-inventory.md`, `docs/discrepancies.md`, and `docs/verification.md` before claiming fidelity or completion. Full live-Figma nested-view inspection is not verified.
