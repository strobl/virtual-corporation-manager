# Company data and change semantics

VCM stores companies, human and AI members, their structure and responsibilities, execution records, workflow artifacts and Time Tracker in one SQLite database: `workspace.sqlite` inside the workspace directory. The default directory is `~/.gitflash`; `--data-dir` or `GITFLASH_DATA_DIR` selects another directory. There is no account, hosted database or model requirement for managing a company or booking delivery hours.

This describes the `0.1.0-alpha.7` corporation-management release model. The [product contract](product/corporation-management.md) changes the primary management experience while retaining the existing domain identities, graph rules and SQLite schema. Published alpha.5/alpha.6 evidence is historical; exact acceptance belongs in the [acceptance record](acceptance.md).

## Company structure

| Record           | Meaning and enforced rules                                                                                                                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company          | Name, unique short code, purpose, color, active/archive state and version. Archived companies keep their short codes.                                                                                                                                                                                       |
| Department       | An explicit company-owned department with a purpose and optional lead. Its lead must have an active assignment to that company.                                                                                                                                                                             |
| Member (`Agent`) | One persisted identity with name, role, `kind: 'human'` or `'agent'`, instructions/working context, responsibilities, optional department and reporting manager. Both kinds use the existing `agents` table. Reporting cycles are rejected. A human is not a login; an AI profile is not a running process. |
| Assignment       | A dated link from a member to a company. Every active member has exactly one active primary assignment and may have additional assignments. Duplicate active pairs are rejected. Sharing preserves the same member ID.                                                                                      |
| Relationship     | Dated ownership or collaboration between two different companies. Ownership is acyclic; specified incoming percentages cannot total more than 100%. Unspecified ownership is allowed and is not treated as a confirmed percentage. Collaboration carries no ownership percentage.                           |
| Work record      | Supplied output linked to a company and member through the established `agentId` field, with manual/Codex/Buzz/Slack provenance and submitted/accepted/failed status. A runtime run ID may appear only once. The UI's new manual and runtime outputs are submitted for a separate acceptance decision.      |
| Execution ledger | Durable request IDs, task status, captured execution context, result, result hash, runtime/session evidence and delivery status. A repeated request ID cannot start a different task.                                                                                                                       |

**Corporations → Create company** takes a name and optional purpose. [QuickCompanySetup](../src/web/QuickCompanySetup.tsx) supplies a valid code/color and builds an empty schema-1 definition, which the existing `definition.import` preview/apply path saves with fresh IDs. A template, member, department, model or task is not required. **Add member** then issues `agent.create` with the chosen human/agent kind; editing issues `agent.update` and retains that kind. These product labels do not rename persisted tables, command names or `agentId` fields.

Name, role, instructions, responsibilities, department and reporting parent are global member fields. Additional company assignments do not create company-specific copies. An active member's department must belong to a company where that member has an active assignment. The reporting manager must be a different active member, with no cycle; the core model does not require the manager to share the viewed company. [CompanyConsole](../src/web/CompanyConsole.tsx) labels another company's department and distinguishes an external reporting parent. Membership, reporting and company ownership remain separate graphs. Ownership points from owner to owned company; its percentages do not represent human shares or a legal cap table.

Archiving a member closes its assignments and clears other members' reporting links to it. Archiving a company closes its assignments and relationships. Members with another company assignment remain active and receive a primary assignment there; members without another assignment are archived. Restoring a company does not silently reopen historical assignments. Restoring a member requires an active company and starts a new primary assignment.

Changing a primary company closes the previous primary period and retains that company as an additional assignment. An additional assignment cannot end if this would leave a current department or department-lead relationship invalid. Update that responsibility first, or include both changes in the same reviewed batch.

A task that completes after its agent was archived can still record its result against the historical assignment. Archiving does not erase completed work. A human's **Record work** uses the same work table, explicitly setting manual provenance, submitted status and null runtime ID/duration. It neither enqueues an agent nor books time. Individual runtime admission and PS-001 role selection reject human members; the [runtime coordinator](../src/adapters/index.ts) and [workflow service](../src/jobs/service.ts) enforce this independently of UI controls.

## Preview, apply and undo

1. A preview validates the entire proposed batch against a specific workspace revision. It records exact field values and changes, but does not change the company.
2. Applying that preview rechecks its base revision inside a SQLite transaction. If anything has changed, VCM refuses the stale preview and requests a fresh review.
3. A successful apply writes all company changes and their audit receipt together, then increments the workspace revision. Retrying the same preview ID returns its existing result without applying it again.
4. Only an undoable configuration change that still matches the current workspace revision is eligible for undo. Undo is an audited transaction with a new revision. It does not delete the audit trail; an intervening time write also prevents undo of the older configuration revision.

Work creation and work acceptance are permanent evidence and cannot be undone through configuration undo. Configuration undo preserves recorded work and the execution ledger. It also cannot reverse an external runtime action or a message already delivered outside VCM.

The interface returns the newest 200 audit receipts; the database retains the complete change history. Entity versions describe their saved state; the workspace revision is the concurrency boundary for all preview/apply/undo operations.

## Templates and portable definitions

Templates are optional starting configurations, separate from creating an empty company. The `studio-20` and `studio-100` templates configure a product studio with 10 departments. The smaller `product-studio` template configures five operational AI seats. The five-seat and 100-agent templates include the role mapping for PS-001; the 20-agent template remains configuration-only. All contain role instructions, with no work results, fabricated activity or automatic activation. Applying a template creates a company; running a job remains a separate explicit action under **Tools → Agent runs & records → Workflow examples**. Configuration size does not imply runtime concurrency or useful execution.

A company definition uses its own portable `schemaVersion: 1`. It includes companies, departments, agents, assignments and relationships. Import validates their structure and references, creates fresh IDs, and adds suffixes to conflicting company short codes. Repeated imports create additional companies; they do not overwrite existing ones. Unknown fields, including work history and runtime credential fields, are rejected.

Definition export preserves configuration and assignment/relationship history. It does not contain execution records, workflow jobs/artifacts, delivery hours, work output, audit receipts, pending previews or runtime credentials. Use a SQLite backup to preserve the full workspace.

## Storage implementation

The alpha.7 candidate retains database schema version **5**. This is separate from the portable definition schema version and release version; the company/Human-or-Agent interface requires no new database migration.

- Version 1 creates normalized company, department, agent, assignment, relationship and work tables, plus workspace revision, preview and audit tables.
- Version 2 adds work-run deduplication and query indexes.
- Version 3 adds the execution ledger to the same database and records whether each change is eligible for undo.
- Version 4 adds the delivery-hours ledger, catalog history, timezone and time request receipts.
- Version 5 adds workflow jobs and captured context, exact artifact bytes and explicit retry receipts.

SQLite foreign keys, unique indexes and transactions complement the domain validator. A migration journal records each schema version, its SQL checksum and application time. A newer unsupported schema is refused, and existing migration checksums must match. Upgrades create a backup before migration; failed migrations roll back their schema and journal changes.

Local files use restricted owner permissions where the operating system supports them. They are ordinary SQLite and text files, not application-encrypted storage. Task artifacts under `runs/` are convenient copies; the execution ledger retains the output needed to view and download completed results after a database restore. See [backup and recovery](recovery.md).

## Delivery hours

Schema 4 adds time entries, captured calculation basis, catalog defaults/overrides, immutable correction/void history, saved IANA timezone and idempotent request receipts. The ledger uses stable company/member IDs and captured names; configuration changes cannot cascade-delete it. Every non-void entry contributes integer tenths to the same weekly and period totals. Booking/correction and catalog writes increment the shared workspace revision and invalidate earlier configuration previews. They are separate from configuration Undo, work acceptance and runtime duration. A time JSON export includes the readable ledger/catalog/history; SQLite backup is the complete restore format. See [Time Tracker](time-tracker.md) for validation and ingress.

## Company workflows

Schema 5 stores a job's request ID, captured company/role/content context, candidate and retry counts, stage history, control outcomes and explicit owner decision. Each artifact row belongs to one job and stage and retains its exact UTF-8 content, SHA-256, byte count and source classification. Model reply text is not converted into artifact files. Runtime-generated files, supplied inputs and independently observed verifier receipts retain separate origins.

The service rejects unsafe paths, links, unsupported files, changed immutable inputs and mismatched observed session receipts. Review-ready or accepted/rejected jobs require a completed five-stage chain with distinct observed sessions, passing criterion records and a successful exact fixed oracle. Restore validates this evidence together with artifact ownership and hashes. Failed attempts remain visible; failure receipts are not rewritten into successful stage evidence. Full SQLite backup restores the workflow and its downloadable files without the original stage directories.

Company configuration changes do not replace the workflow ledger. A workflow captures its identities at start; later role edits do not silently rewrite that evidence. New completed workflows use format-2 bundles retaining the pinned expected-reference input, complete producer/support files and stage evidence. Historical format-1 bytes and owner decisions remain unchanged; see the [workflow contract](product-studio.md).

Job completion, QA success, owner review and delivery-hours entries are independent records. The actual v2 intake and one retry each timed out at 300 seconds with `ultra`; no v2 bundle or owner acceptance exists, and the earlier v1 download remains rejected for a missing expected-reference file. A preserved failure is valid historical data, not a completed deliverable. Useful management, live integrations and useful runtime output each need their own observed evidence.
