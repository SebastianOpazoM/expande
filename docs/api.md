# Browser API

The browser API is intentionally separate from the administrative CLI. There is no public SQL endpoint or administrative record editor.

| Endpoint                | Behavior                                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`       | Minimal unauthenticated health status                                                                                                  |
| `GET /api/v1/access`    | Whether the shared access gate is required and the request has passed it                                                               |
| `POST /api/v1/access`   | JSON `{ "password": "..." }`; signed HTTP-only access cookie; failed attempts rate limited                                             |
| `GET /api/v1/bootstrap` | Resolves/creates the persistent visitor session; returns shared catalog and current company/user-visible records, profiles and context |
| `GET /api/v1/revision`  | Lightweight `{ "revision": "catalogRevision:sessionRevision" }` for visible-tab polling                                                |
| `POST /api/v1/actions`  | Validated domain action; returns the updated bootstrap snapshot                                                                        |

Cookies are server-resolved; the browser cannot supply a session UUID in the action payload. Browser actions require JSON, same-origin requests, ownership checks and the appropriate demo role. No CORS administrative access is enabled. Error bodies use `{ "error": { "code": "...", "message": "..." } }`; invalid input is 400, stale record revisions 409, role/ownership errors 403 and missing access 401.

Action types are implemented and validated centrally in `server/actions.ts`:

- `profile`, `register`, `reset`, `clock` for demo context. Reset requires explicit `confirm: true`.
- `saved`, `follow` using the exact target type/ID. Following is distinct from saving and submitting.
- `draft`, `register_application`, `application_status`, `document`, `question` for challenge/application flows. Drafts preserve null submission dates; status changes add matching history events; documents contain metadata only.
- `save_record` for allowed company, own user, solution, alert-rule and delegation fields. Existing records require `revision` from the original form snapshot. The server whitelists editable fields and rejects schema/reference violations.
- `delete_record` for owned rules or cancelling delegations, with confirmation and revision.
- `invite`, `member` for administrator-only team changes. No email is sent and the last active administrator is protected.
- `read_notice`, `read_all`, `progress` for personal state.
- `activity` for local simulated requests, registration, reminders, plan interest and concept reactions. The target must exist; private targets must belong to the active company/user.

Persistent row `_rev` values are storage metadata. The CLI's `schema` command exposes the effective record contract. The original seed schema is preserved unchanged; nullable TRL in a prepared snapshot is an explicit runtime extension documented in `discrepancies.md`.

UI forms capture record revisions when opened. Revision polling refreshes data without replacing uncontrolled field contents. Saving a form after an agent has changed the same record produces a conflict rather than silently overwriting the agent's update.
