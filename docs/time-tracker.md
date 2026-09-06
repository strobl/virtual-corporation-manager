# Time Tracker

Time Tracker records **Delivery hours**: booked human-equivalent effort for a company and member on a calendar date. Hours can be explicitly entered or estimated from a deliverable reference. They are not a stopwatch, runtime duration, invoiced revenue, payment evidence or proof that an output was accepted. Running or accepting work does not automatically book time.

## A manager's week

Open **Time Tracker**, select a company and a Monday–Sunday week, then open a member's day. Each day may contain several entries. Record the date, member, hours, what was done and an optional client project. Inspect an entry to see its basis, original source and history. Correct an entry or void it with a reason; earlier versions remain available. All non-void entries count in the weekly and period totals.

Use the catalog to find a code, name, business category and reference hours. A quantity multiplies the reference. Explicit hours override that estimate. Unknown requested deliverables use **8 hours × quantity**, visibly labelled **fallback estimate** with the unmatched request retained. This never claims a catalog match. An input with neither hours nor a deliverable is invalid.

Explicit hours must be a positive multiple of 0.1, up to 500 hours per entry. Quantity must be positive and no greater than 100. A reference calculation rounds once to tenths; a zero or greater-than-500 result is refused. There is no 24-hour day cap: these are human-equivalent delivery hours, so an 80-hour reference can be booked on one delivery date. Catalog changes affect future calculations; an existing entry retains its captured reference and version.

The workspace timezone defaults to UTC and is saved locally. Dates must be real `YYYY-MM-DD` calendar dates; newly supplied dates cannot be in the future in that timezone. Weeks start Monday. Changing the timezone does not shift historical booked dates or block metadata corrections that preserve the saved date. Explicit company/member booking requires an existing current or historical assignment to that company; this permits retrospective administrator entry and does not assert that the assignment covered the booked date. Fresh bookings require active company/member records. Existing entries remain readable and correctable after archival or deletion, retaining their captured company/member identity.

Period analytics use inclusive last-7-days, last-30-days, current-month or custom windows. Daily series include zero dates. Hours per active day divides by days containing non-void entries, not by the entire window. Empty periods have zero hours and entries. Company/member breakdowns use the entry's recorded company/member, not today's primary assignment.

## Local agent API

The running server exposes its API only on loopback. It uses the same Host/Origin checks and per-process session token as the local console. A trusted process on this computer can retrieve `GET /api/session` and send its token as `X-GitFlash-Token`. The token rotates on restart. Do not publish it or expose the local port as a remote service.

`GET /api/time/catalog` returns the effective catalog. `GET /api/time` returns the ledger, effective catalog, history, saved timezone and current local date. `POST /api/time/ingest` accepts one entry or `{ "entries": [...] }` with 1–50 entries. Each entry requires a stable `requestId`, `agentId`, strict date and description, plus hours or a requested deliverable. Prefer an explicit `companyId`; omission resolves only one unambiguous active primary assignment. A browser selection never supplies this authority.

```json
{
  "requestId": "my-agent-job-2026-09-01-entry-1",
  "agentId": "EXISTING_AGENT_ID",
  "companyId": "EXISTING_COMPANY_ID",
  "date": "2026-09-01",
  "hours": 0.7,
  "description": "Reviewed the installation guide and recorded corrections.",
  "clientProject": "Documentation"
}
```

Use `GET /api/state` to obtain actual company/agent IDs and verify their assignments, and choose a date valid for the workspace timezone. This example is illustrative and does not claim work occurred. A catalog request replaces `hours` with `deliverable` and optional `quantity`; both may be supplied when explicitly overriding its reference. Optional `workId`/`runId` links must match the recorded company/member and never accept the linked result.

This Node.js example sends a local JSON file without printing the session token:

```javascript
// Save as send-time.mjs, then: node send-time.mjs ./entries.json
import { readFile } from 'node:fs/promises';
const base = 'http://127.0.0.1:4310'; // use the URL printed by your server
const sessionResponse = await fetch(`${base}/api/session`);
if (!sessionResponse.ok) throw new Error('Start the local VCM server first.');
const { token } = await sessionResponse.json();
const payload = JSON.parse(await readFile(process.argv[2], 'utf8'));
const response = await fetch(`${base}/api/time/ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-GitFlash-Token': token },
  body: JSON.stringify(payload),
});
const result = await response.json();
console.log(JSON.stringify(result, null, 2));
if (!response.ok || result.results?.some((row) => !row.ok)) process.exitCode = 1;
```

The response contains individual `{ index, ok, receipt }` or `{ index, ok, error }` results. All-success requests return 201; any per-entry failure returns 207. Malformed batch envelopes fail before writing. Successful entries in a mixed batch remain saved. Retry failed rows after correcting them; reuse each successful row's request ID and identical payload to retrieve its original receipt without duplication. The same key with different input conflicts. Catalog edits and restarts cannot reprice a replay. Keep request IDs stable across uncertain network outcomes.

`POST /api/time/mutate` is the console's typed create/correct/void/catalog/timezone route. Corrections and voids require the expected entry version; stale edits return a conflict so the user can inspect the current entry. These writes are audited and invalidate stale configuration previews. Time corrections do not use configuration Undo.

## Export and recovery

Download `GET /api/time/export` for a versioned JSON ledger/catalog/history export while the server runs. For a stopped workspace:

```sh
vcm time-export --data-dir ./my-company --output ./delivery-hours.json
vcm backup --data-dir ./my-company --output ./company-with-time.sqlite
vcm restore --data-dir ./restored-company --from ./company-with-time.sqlite
```

The JSON time export is an inspectable data artifact, not a full restore format. SQLite backup/restore is the supported complete recovery path and includes time, catalog overrides/history, replay receipts, company configuration and work/run evidence. Existing `vcm export` remains company configuration only and contains no booked hours.

Schema 4 adds the separate ledger. Opening a supported older workspace creates a pre-upgrade backup, retains its existing IDs/history and starts with no booked time. An older binary cannot open the newer schema; use its pre-upgrade backup for a downgrade. Never overwrite a public release archive with a different local candidate under the same version.
