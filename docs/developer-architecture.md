# Architecture for contributors

VCM is one TypeScript application: a Node.js process serves a prebuilt React interface on loopback and opens one local SQLite workspace. It has no required account service, hosted database, billing layer or telemetry. This is a single-operator workspace, not a supported shared LAN service.

## Configuration and records

| Model                       | Meaning                                                                                                                   | Does not imply                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Corporation / company       | Identity, purpose and a container for organization context                                                                | A legal entity, running business or provider account          |
| Department                  | A company's grouping, with an optional lead                                                                               | A runtime queue                                               |
| Member and dated assignment | `Agent` represents a Human or AI Agent through `kind`; role, instructions, responsibilities and dated company assignments | A running process, shared login or synchronized external chat |
| Member reporting line       | Optional `managerId` between members, validated against cycles; shared across the member's company assignments            | Automatic task delegation                                     |
| Company relationship        | Separately typed ownership or collaboration, with its own dates                                                           | An agent reporting edge                                       |
| Work / job result           | Persisted output and evidence of the supported manual or optional execution route                                         | Booked delivery hours                                         |
| Time entry                  | Explicit human-equivalent effort, captured basis and retained correction history                                          | Measured runtime, payroll, savings or result acceptance       |

The [three-agent definition](examples/three-agent-studio.json) uses one corporation, one department and three primary assignments. Its agents are peers. It has no company ownership/collaboration edges, work history or booked hours. This is the actual portable schema, not a separate example language.

Humans and AI Agents share the existing `Agent` type, `agents` collection, `agentId` references and `agent.*` commands. Those identifiers remain compatible; they do not limit the product to AI members. Each active member has one primary assignment and may have additional company memberships. Membership, the primary execution company, reporting and company ownership remain separate relationships. See [the current product model](product/corporation-management.md).

## A reviewed change

The browser submits a typed command to `POST /api/preview` with the current workspace revision. The store validates the entire result and persists a preview. `POST /api/apply` confirms its ID in a transaction. Stale previews are refused; replaying a committed receipt returns its outcome without applying twice. Undo is version-aware and does not reverse external actions. The browser retains an uncertain Apply receipt for **Retry save** after a reload.

The primary create flow asks for a name and optional purpose, then reviews and saves one empty corporation. `QuickCompanySetup` builds a portable definition through the shared `corporation-setup.ts` helpers; `App` submits it for review. A template, department, member or runtime is not a prerequisite. Company/member, relationship and assignment forms retain their drafts while the authoritative preview is visible, so Back can return to editing. Readable member reviews expose changed management fields and the affected company scope. Missing or archived advanced-dialog targets have an unavailable state; they do not replace an uncertain save receipt.

Time writes have a separate ingress and immutable correction/void history, sharing the same workspace revision. They are not configuration Undo. Execution receipts, accepted output and time entries remain separate records.

## Source map

`App` makes **Corporations** and **Time Tracker** the primary navigation. Opening a company shows `CompanyConsole`; member and department inspection stay in that company context. **Tools** contains **Agent runs & records**, **Connections** and the detailed **Organization tools** views. Normal department management does not require switching to those advanced views.

| Location                                                                                                      | Responsibility                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/index.ts`, `src/brand.ts`                                                                            | Command parsing, workspace path and process lifecycle, visible terminal identity                                                        |
| `src/server/index.ts`                                                                                         | Loopback HTTP routes and local request protection                                                                                       |
| `src/domain/contracts.ts`, `src/domain/model.ts`                                                              | Definition/command types, validation and organization invariants                                                                        |
| `src/db`                                                                                                      | SQLite schema, migrations, lock, reviewed changes and backup/restore                                                                    |
| `src/web/App.tsx`, `src/web/CorporationWorkspace.tsx`                                                         | Navigation, active company/member context, corporation index and integration of the save review                                         |
| `src/web/CompanyConsole.tsx`, `src/web/company-console-model.ts`, `src/web/company-console.css`               | Current company workspace: Humans/AI Agents, responsibilities, reporting, department inspection, relationships and scoped hours summary |
| `src/web/QuickCompanySetup.tsx`, `src/web/corporation-setup.ts`                                               | Name/optional-purpose setup, default identity values and construction of the empty corporation definition                               |
| `src/web/Dialogs.tsx`, `src/web/change-recovery.ts`                                                           | Company/member/department editing, readable previews, retained drafts and recovery of the same uncertain save                           |
| `src/web/AdvancedDialogs.tsx`, `src/web/HumanResultDialog.tsx`                                                | Reviewed relationships, membership and configuration import; manual completed-human-work capture                                        |
| `src/web/CompanyMap.tsx`, `src/web/AgentPlacement.tsx`, `src/components/organization/CorporationOrgChart.tsx` | Detailed ownership/reporting visualization and member placement in Organization tools                                                   |
| `src/time`, `src/web/TimeTracker.tsx`                                                                         | Delivery-hours calculations, persisted history and interface                                                                            |
| `src/jobs`, `src/adapters`                                                                                    | Bounded optional execution and observed result/receipt handling                                                                         |
| `docs/examples`                                                                                               | Portable fictional configuration and a local import/recovery verification route                                                         |

The older three-step `src/web/CorporationSetup.tsx` remains in the source tree but is not mounted by the current `App`. Its Identity → Structure → Review wizard and starter structure do not define the current first-save journey. The [earlier product/task audit](product-task-audit.md) is a historical inspection, not this source map.

The CompanyConsole activity summary covers direct runs only; workflow jobs remain separate in the work records view. Failed run or connection refreshes produce unavailable states rather than a claim of no active work or a ready runtime. Company totals open Time Tracker with all company members; a member's Log time action retains that member's company context. These are navigation/read-model responsibilities, not changes to the time ledger.

The browser's product identity is in `src/web/identity.ts`; package name, default `~/.gitflash`, legacy environment variables and wire-format names retain compatibility. Do not globally replace those identifiers or edit historical migration SQL to change branding.

## Data and API boundaries

SQLite schema 5 is the complete workspace. Portable company definitions use independent `schemaVersion: 1`. Import remaps IDs and appends configuration; it is not declarative reconciliation. Unknown fields are rejected, including credentials and work history. The [data model](data-model.md) explains references and migration contracts.

`GET /api/state`, `/api/export` and `/api/time/export` are existing local read surfaces. For mutations, the browser obtains the per-process capability from `/api/session` and sends `X-GitFlash-Token`. Host, origin and cross-site checks guard the loopback boundary. This is local process protection, not authentication for multiple users. Never expose the server through a tunnel or proxy. These are implementation interfaces of this alpha, not a promised stable third-party SDK or plugin API.

Definition export preserves configuration; time export preserves an inspectable ledger snapshot; only SQLite backup/restore preserves the full state and replay receipts together. Provider credentials and tool installations remain external. See [quickstart recovery](developer-quickstart.md#export-and-recovery), [security](../SECURITY.md) and [the detailed architecture](architecture.md).

## Optional execution

Creating roles is offline configuration. Explicit individual tasks and the fixed five-stage Product Studio job are optional, separately limited routes using the operator's runtime access. A company workflow runs roles sequentially and waits for the owner's result decision. It is not an arbitrary workflow graph or a universal agent orchestrator. Experimental Buzz/Slack routes and platform-specific sandbox prerequisites are described in [integrations](integrations.md). Local-core contributor work needs no paid provider access.

Only AI Agent members receive execution controls. Their direct tasks use the supported primary-company routing; selecting another membership does not change that execution target. Humans can record completed work with manual provenance through `HumanResultDialog`; this neither dispatches future work nor creates a provider receipt or booked hours.
