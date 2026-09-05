# Architecture

GitFlash is one TypeScript application. A Node.js process serves a prebuilt React console on `127.0.0.1`. SQLite stores companies, departments, agents, dated assignments, relationships, work, reviewed changes, runtime receipts and a separate delivery-hours ledger. There is no hosted database, account service, billing layer or required telemetry.

The browser reads a workspace snapshot and submits typed commands. Every configuration command is validated to produce a persisted preview at a specific workspace revision. Confirmation applies that exact preview in one transaction. Repeating confirmation is idempotent; intervening changes invalidate stale previews. Supported undo is version-aware and does not reverse an external action.

The CLI owns the selected data directory and the store owns an exclusive process lock. The HTTP boundary rejects unknown Host values, foreign origins, cross-site requests and mutation requests without a random per-process capability. The same-origin console and trusted local processes can retrieve the capability from the loopback session endpoint. This is a local process protection, not an account or multi-user permission system. LAN hosting and tunnels are outside the supported deployment model.

Optional integrations receive a fixed role and task. Creating an agent does not launch it. Codex is an optional external executor; it uses its own installed CLI and authenticated provider access. Buzz and Slack are optional communication routes with separate prerequisites. The product records actual results and provenance; human acceptance is a separate action.

The initial SQLite driver is Node's built-in `node:sqlite`, exercised on Node 24.19 during development. It avoids a separately compiled database addon. The [Node SQLite documentation](https://nodejs.org/api/sqlite.html) describes the upstream API. Release evidence states the exact tested runtime/platform matrix; support is never inferred from source compilation alone.

The visual console selectively adapts the predecessor's organization layout, reporting chart and design primitives. Hosted wrappers, auth, SaaS billing and private history are excluded. See third-party notices and contribution guidance for source treatment.

The Time Tracker uses targeted SQLite writes in the same store/lock and shared revision boundary. Booking, correction/void, catalog basis, history and request receipt commit atomically. Configuration snapshot replacement never replaces the time ledger; time changes invalidate older configuration previews. Integer tenths of a human-equivalent hour drive all totals, separately from execution duration and output acceptance. See [Time Tracker](time-tracker.md).
