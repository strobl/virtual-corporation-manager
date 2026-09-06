# VCM corporation workspace — candidate review

**Preparation status, 5 September 2026:** This unpublished corporation-first successor uses the `0.1.0-alpha.4-local.1` review version. It implements **Set up your virtual corporation.** The public alpha.2 release and the earlier frozen alpha.3 archive are separate artifacts; neither identifies this interface. Install the exact supplied archive using the [README commands](../README.md), compare its source revision and SHA-256 with the current handoff, and record exact package/browser checks in [acceptance](acceptance.md). A matching version string alone is insufficient.

## Corporation-first journey

| Destination              | Actual behavior                                                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Your corporations**    | Lists active corporations with their identity, agent/department counts and current-week recorded delivery hours. Empty workspaces have one primary **Set up a corporation** action and a secondary **Browse company templates** path.                                                      |
| **Set up a corporation** | Identity → Structure → Review. Start empty or use the editable two-department, three-agent small team. **Review changes** requests authoritative validation; **Apply changes** saves once and selects the resulting company overview.                                                      |
| **Company overview**     | Shows the selected company's purpose, actual reporting structure, assigned-member counts, current-week recorded hours and recent ledger entries. **Add agent**, **Add department**, **Manage organization** and **Log time** lead to existing real controls.                               |
| **Organization**         | Company map, reporting lines and agent list retain the existing domain. Agent details show company, department, manager and additional assignment context before responsibilities/instructions. Templates remain available here and from **Your corporations → Browse company templates**. |
| **Time Tracker**         | Weekly entries, reference catalog and hours analytics. Company/agent context is passed from the overview or inspector; **Log time** opens the existing booking form once, with explicit save and cancel. Empty companies have a direct **Add agent** action.                               |
| **Work / Integrations**  | Secondary optional execution and connection destinations. Starting a job still requires its separate explicit confirmation; configuration does not dispatch providers or create time entries.                                                                                              |

Navigation uses the local application's existing screen state. `?area=` retains the chosen destination on reload; `?selected=` identifies the company, department or agent. There are no invented hosted corporation-creation routes.

Setup Back/Edit keeps the entered draft. Cancel or Discard before Apply creates no company. A stale first review refreshes the workspace revision and preserves the definition. After a definite stale Apply rejection, refreshing the preview uses the current revision and company-ID baseline so completion selects the company created by that operation.

If an Apply response is interrupted, the UI shows **Save confirmation pending** and **Retry save**. It retains the same preview receipt in the mounted dialog and tab session storage. Refresh and Discard remain unavailable until the original save is confirmed or definitely rejected; repeating that receipt cannot create a second imported corporation. This recovery must be checked with a genuinely lost response, separately from an ordinary double-click test.

## Identity and preserved contracts

The browser uses the canonical corporation-frame glyph, lockup and favicon, with deep ink, restrained teal, warm surfaces and system typography. Browser configuration is in `src/web/identity.ts`. Source and support links use [strobl/virtual-corporation-manager](https://github.com/strobl/virtual-corporation-manager).

- The canonical command is `vcm`, with the established compatibility alias. Package, data-directory, environment-variable and protocol identifiers follow the [naming and compatibility contract](branding.md). Repository renaming does not rename local data.
- Global manager relationships and primary/additional dated agent assignments remain truthful. Reporting hierarchy is distinct from company ownership; no decorative control pretends to save a relationship.
- Time Tracker retains 124 reference definitions, explicit delivery hours, correction/void history, catalog versions and analytics. Runtime duration and owner acceptance never create hours.
- Backup/restore, individual tasks, integrations and historical records remain accessible. Stored names, owners, receipts and artifact bytes are not rewritten for branding.
- Agent Operations source hashes and original import receipts retain their accepted identities. Shipped product wording uses VCM through a separately recorded [branding adaptation](agent-operations/branding-receipt.json); role, rubric and oracle behavior is preserved.

## Review and publication boundary

Record the exact successor checkout/archive, isolated data directory and local URL for empty and populated review workspaces. Verify first setup, cancellation, stale review, uncertain-save replay, two-company switching, agent/reporting edits, multiple daily time entries and correction/history after reload. Inspect both desktop and 390px layouts, including keyboard focus, navigation, long text and real five-role/100-role organization views. Source tests do not replace this rendered acceptance.

Historical UI source `8638887434d3316238189b25bc236006cf56f3cf` and runtime baseline `53d97457ea2b7ec78f730c8c9466036d9f07870c` identify earlier accepted work. The frozen alpha.3 source `d47e1984949b9d93106e0c211326cc56f8351981` predates this redesign. Their earlier local.4/alpha.3 package and browser evidence remains attached to those exact bytes, not transferred to this successor. Prior review workspaces remain intact.

Repository rename, public code merge, release publication, website deployment and custom-domain activation are distinct events. The repository URL above is current; a new release or domain is not asserted by this document. Verify the eventual tag, downloaded archive and intended deployment target separately. The separate FDE website and historical releases retain their existing identities. Do not direct an installation to an older artifact while claiming that this UI is included. No new provider run or external human usefulness pilot is implied by these changes.
