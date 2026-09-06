# Architecture for contributors

VCM is one TypeScript application: a Node.js process serves a prebuilt React interface on loopback and opens one local SQLite workspace. It has no required account service, hosted database, billing layer or telemetry. This is a single-operator workspace, not a supported shared LAN service.

## Configuration and records

| Model                      | Meaning                                                                                         | Does not imply                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Corporation / company      | Identity, purpose and a container for organization context                                      | A legal entity, running business or provider account    |
| Department                 | A company's grouping, with an optional lead                                                     | A runtime queue                                         |
| Agent and dated assignment | Role, instructions and responsibilities; a primary company plus optional additional assignments | A running process or synchronized external chat         |
| Agent reporting line       | Optional `managerId` between agents, validated against cycles                                   | Automatic task delegation                               |
| Company relationship       | Separately typed ownership or collaboration, with its own dates                                 | An agent reporting edge                                 |
| Work / job result          | Persisted output and evidence of the supported manual or optional execution route               | Booked delivery hours                                   |
| Time entry                 | Explicit human-equivalent effort, captured basis and retained correction history                | Measured runtime, payroll, savings or result acceptance |

The [three-agent definition](examples/three-agent-studio.json) uses one corporation, one department and three primary assignments. Its agents are peers. It has no company ownership/collaboration edges, work history or booked hours. This is the actual portable schema, not a separate example language.

## A reviewed change

The browser submits a typed command to `POST /api/preview` with the current workspace revision. The store validates the entire result and persists a preview. `POST /api/apply` confirms its ID in a transaction. Stale previews are refused; replaying a committed receipt returns its outcome without applying twice. Undo is version-aware and does not reverse external actions. The browser retains an uncertain Apply receipt for **Retry save** after a reload.

Time writes have a separate ingress and immutable correction/void history, sharing the same workspace revision. They are not configuration Undo. Execution receipts, accepted output and time entries remain separate records.

## Source map

| Location                                                                        | Responsibility                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/cli/index.ts`, `src/brand.ts`                                              | Command parsing, workspace path and process lifecycle, visible terminal identity |
| `src/server/index.ts`                                                           | Loopback HTTP routes and local request protection                                |
| `src/domain/contracts.ts`, `src/domain/model.ts`                                | Definition/command types, validation and organization invariants                 |
| `src/db`                                                                        | SQLite schema, migrations, lock, reviewed changes and backup/restore             |
| `src/web/CorporationSetup.tsx`, `corporation-setup.ts`                          | Editable corporation definition and first-save flow                              |
| `src/web/CorporationWorkspace.tsx`, `AgentPlacement.tsx`, `AdvancedDialogs.tsx` | Corporation view, agent context and configuration import                         |
| `src/time`, `src/web/TimeTracker.tsx`                                           | Delivery-hours calculations, persisted history and interface                     |
| `src/jobs`, `src/adapters`                                                      | Bounded optional execution and observed result/receipt handling                  |
| `docs/examples`                                                                 | Portable fictional configuration and a local import/recovery verification route  |

The browser's product identity is in `src/web/identity.ts`; package name, default `~/.gitflash`, legacy environment variables and wire-format names retain compatibility. Do not globally replace those identifiers or edit historical migration SQL to change branding.

## Data and API boundaries

SQLite schema 5 is the complete workspace. Portable company definitions use independent `schemaVersion: 1`. Import remaps IDs and appends configuration; it is not declarative reconciliation. Unknown fields are rejected, including credentials and work history. The [data model](data-model.md) explains references and migration contracts.

`GET /api/state`, `/api/export` and `/api/time/export` are existing local read surfaces. For mutations, the browser obtains the per-process capability from `/api/session` and sends `X-GitFlash-Token`. Host, origin and cross-site checks guard the loopback boundary. This is local process protection, not authentication for multiple users. Never expose the server through a tunnel or proxy. These are implementation interfaces of this alpha, not a promised stable third-party SDK or plugin API.

Definition export preserves configuration; time export preserves an inspectable ledger snapshot; only SQLite backup/restore preserves the full state and replay receipts together. Provider credentials and tool installations remain external. See [quickstart recovery](developer-quickstart.md#export-and-recovery), [security](../SECURITY.md) and [the detailed architecture](architecture.md).

## Optional execution

Creating roles is offline configuration. Explicit individual tasks and the fixed five-stage Product Studio job are optional, separately limited routes using the operator's runtime access. A company workflow runs roles sequentially and waits for the owner's result decision. It is not an arbitrary workflow graph or a universal agent orchestrator. Experimental Buzz/Slack routes and platform-specific sandbox prerequisites are described in [integrations](integrations.md). Local-core contributor work needs no paid provider access.
