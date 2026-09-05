# Company data and change semantics

GitFlash stores the local company and its execution ledger in one SQLite database: `workspace.sqlite` inside the workspace directory. The default directory is `~/.gitflash`; `--data-dir` or `GITFLASH_DATA_DIR` selects another directory. There is no account, hosted database or model requirement for configuring a company.

## Company structure

| Record           | Meaning and enforced rules                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company          | Name, unique short code, purpose, color, active/archive state and version. Archived companies keep their short codes.                                                                                                                                                             |
| Department       | An explicit company-owned department with a purpose and optional lead. Its lead must have an active assignment to that company.                                                                                                                                                   |
| Agent            | Name, role, agent/human kind, instructions, responsibilities, department and reporting manager. Reporting cycles are rejected. A configured agent is not a running process.                                                                                                       |
| Assignment       | A dated link from an agent to a company. Every active agent has exactly one active primary assignment and may have additional assignments. Duplicate active pairs are rejected.                                                                                                   |
| Relationship     | Dated ownership or collaboration between two different companies. Ownership is acyclic; specified incoming percentages cannot total more than 100%. Unspecified ownership is allowed and is not treated as a confirmed percentage. Collaboration carries no ownership percentage. |
| Work record      | Supplied output linked to a company and agent, with manual/Codex/Buzz/Slack provenance and submitted/accepted/failed status. A runtime run ID may appear only once. Acceptance is a separate operator decision.                                                                   |
| Execution ledger | Durable request IDs, task status, captured execution context, result, result hash, runtime/session evidence and delivery status. A repeated request ID cannot start a different task.                                                                                             |

Archiving an agent closes its assignments and clears other agents' reporting links to it. Archiving a company closes its assignments and relationships. Agents with another company assignment remain active and receive a primary assignment there; agents without another assignment are archived. Restoring a company does not silently reopen historical assignments. Restoring an agent requires an active company and starts a new primary assignment.

Changing a primary company closes the previous primary period and retains that company as an additional assignment. An additional assignment cannot end if this would leave a current department or department-lead relationship invalid. Update that responsibility first, or include both changes in the same reviewed batch.

A task that completes after its agent was archived can still record its result against the historical assignment. Archiving does not erase completed work.

## Preview, apply and undo

1. A preview validates the entire proposed batch against a specific workspace revision. It records exact field values and changes, but does not change the company.
2. Applying that preview rechecks its base revision inside a SQLite transaction. If anything has changed, GitFlash refuses the stale preview and requests a fresh review.
3. A successful apply writes all company changes and their audit receipt together, then increments the workspace revision. Retrying the same preview ID returns its existing result without applying it again.
4. Only the latest configuration change is eligible for undo. Undo is an audited transaction with a new revision. It does not delete the audit trail.

Work creation and work acceptance are permanent evidence and cannot be undone through configuration undo. Configuration undo preserves recorded work and the execution ledger. It also cannot reverse an external runtime action or a message already delivered outside GitFlash.

The interface returns the newest 200 audit receipts; the database retains the complete change history. Entity versions describe their saved state; the workspace revision is the concurrency boundary for all preview/apply/undo operations.

## Templates and portable definitions

The `studio-20` and `studio-100` templates configure a product studio with 10 departments. They contain distinct roles and responsibility instructions, and no work results, fabricated activity or automatic activation.

A company definition uses its own portable `schemaVersion: 1`. It includes companies, departments, agents, assignments and relationships. Import validates their structure and references, creates fresh IDs, and adds suffixes to conflicting company short codes. Repeated imports create additional companies; they do not overwrite existing ones. Unknown fields, including work history and runtime credential fields, are rejected.

Definition export preserves configuration and assignment/relationship history. It does not contain execution records, work output, audit receipts, pending previews or runtime credentials. Use a SQLite backup to preserve the full workspace.

## Storage implementation

The database currently uses schema version **3**. This is separate from the portable definition schema version.

- Version 1 creates normalized company, department, agent, assignment, relationship and work tables, plus workspace revision, preview and audit tables.
- Version 2 adds work-run deduplication and query indexes.
- Version 3 adds the execution ledger to the same database and records whether each change is eligible for undo.

SQLite foreign keys, unique indexes and transactions complement the domain validator. A migration journal records each schema version, its SQL checksum and application time. A newer unsupported schema is refused, and existing migration checksums must match. Upgrades create a backup before migration; failed migrations roll back their schema and journal changes.

Local files use restricted owner permissions where the operating system supports them. They are ordinary SQLite and text files, not application-encrypted storage. Task artifacts under `runs/` are convenient copies; the execution ledger retains the output needed to view and download completed results after a database restore. See [backup and recovery](recovery.md).

## Delivery hours

Schema 4 adds time entries, captured calculation basis, catalog defaults/overrides, immutable correction/void history, saved IANA timezone and idempotent request receipts. The ledger uses stable company/member IDs and captured names; configuration changes cannot cascade-delete it. Every non-void entry contributes integer tenths to the same weekly and period totals. Booking/correction and catalog writes increment the shared workspace revision and invalidate earlier configuration previews. They are separate from configuration Undo, work acceptance and runtime duration. A time JSON export includes the readable ledger/catalog/history; SQLite backup is the complete restore format. See [Time Tracker](time-tracker.md) for validation and ingress.
