# Changelog

## 0.1.0-alpha.3-local.2 — local review candidate

- Restore a local Time Tracker with multiple dated delivery-hour entries, catalog references and labelled fallback estimates, corrections/voids/history, weekly and period views, and loopback agent ingestion.
- Add schema 4 and preserve time data through configuration edits, preview/undo, restart and full SQLite recovery. Add a separate time JSON export.
- Bring the company structure earlier in the manager view, preserve work-result company context, and apply the compact corporation identity.
- This is an unpublished local candidate. Its version and bytes do not replace public alpha.2.

## 0.1.0-alpha.2

- Keep long task briefs in an accessible disclosure so execution evidence and results remain reachable.
- Keep long company descriptions readable in the header and map, with full text available in details.
- Preserve saved task, output and company text; no database migration or runtime behavior change.
- Deploy the technical page through its documented, permitted `main` workflow instead of an unsupported release-tag trigger.

## 0.1.0-alpha.1

First local technical alpha: terminal startup, protected loopback server, prebuilt React console and SQLite persistence. Company/department/agent lifecycle, dated assignments, ownership and collaboration, reviewed changes, stale-preview refusal, idempotent confirmation and version-aware undo.

Includes local 20- and 100-role studio templates, configuration import/export, backup/restore, migrations and a single-writer lock. Optional Codex CLI tasks produce durable output and provenance; accepting useful work is a separate action. Buzz team snapshots and experimental Buzz/Slack routes are included with explicit prerequisites and known evidence gaps.

The release does not claim production readiness, 100 concurrent runtimes, complete Buzz/Slack end-to-end validation or human-pilot success. See release acceptance and handoff documents for the exact verified scope.
