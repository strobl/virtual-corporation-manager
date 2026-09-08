# VCM corporation workspace

This document describes the **`0.1.0-alpha.9` corporation-management technical prerelease**: one company context with humans and agents, responsibilities, reporting and company relationships. Execution is a secondary utility. Use the exact versioned archive and source/checksum record, or build the matching checkout through the [README](../README.md#install-the-reviewed-archive). The [acceptance record](acceptance.md) and versioned release manifest identify actual package and browser checks; this interface description does not substitute for them.

## Corporation-management journey

| Destination                      | Current behavior                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Corporations**                 | Lists active companies with their identity and human/agent membership counts. The company list also remains in the sidebar. Choose **Create company**; an empty workspace shows **Create your company**.                                                                       |
| **Create your company**          | Enter **Company name** and optional **Purpose** → **Continue** → review → **Create company**. Internal code and color receive valid defaults. The saved company starts with an empty team. **Back** keeps the draft; **Cancel** before confirmation saves nothing.             |
| **Company workspace**            | Shows purpose, members, departments, reporting and ownership together. Selecting a member opens details beside the company. **Add member** supports **AI agent** and **Human**; **Edit member** reviews and saves changes to the same identity.                                |
| **Membership and relationships** | **Company assignments → Manage** preserves shared identities and primary/additional membership. **Company relationships → Manage** records company ownership or collaboration; **Owned by** and **Owns** keep direction explicit. These are not human shareholdings.           |
| **Time Tracker**                 | The existing weekly ledger, catalog, estimates, corrections, history, analytics and exports remain. The company total opens the whole-company ledger; a member's **Log time** opens the existing booking form with company/member context. No automatic booking is introduced. |
| **Tools**                        | **Agent runs & records**, its **Workflow examples** tab, **Connections** and **Organization tools** retain optional execution, runtime setup and detailed organization views. Humans can **Record work** as manual submitted text; only agents have an execution control.      |

Use **Departments → Add** and a member's **Department & reporting line** editor when structure is needed. Member roles and responsibilities apply across their company assignments. Another company's department is identified explicitly; a shared agent's task action points to its actual execution company.

Navigation uses the existing local screen state: `?area=` identifies the destination and `?selected=` identifies company/member context on reload. No hosted account or corporation-creation service is introduced. Opening a company returns to its heading. Selecting a member focuses its details, with mobile scrolling; closing returns focus to the visible member. The accepted navigation corrections preserve company scope when opening its hours total and order the parent area reset before member-inspector focus.

## Review and recover a save

Company and member editors keep their entered values while the save preview is open. Member creation uses **Review change → Add member**; edits use **Review change → Save member**. Imports, department/company edits and manual work records use the existing **Apply changes** confirmation. The preview's technical details remain inspectable.

A stale first review refreshes the workspace revision while keeping the pending change. After a definite stale Apply rejection, refresh the preview and review it again. An uncertain Apply response shows **Save confirmation pending → Retry save**; the same preview receipt remains in memory and tab session storage. Refresh/discard are unavailable until that receipt is confirmed or definitely rejected. This must not become another import or an automatic second save.

## Identity and preserved contracts

The browser and CLI identify the product as VCM — Virtual Corporation Manager. The canonical command is `vcm`; package, data-directory, environment-variable and protocol identifiers follow the [naming and compatibility contract](branding.md). Existing company names, instructions, records and artifact bytes are not rewritten for branding.

- Companies, human/agent identities, primary/additional assignments, global reporting and ownership retain their existing domain rules. Human membership does not create a login or permit agent execution.
- Time Tracker's 124 reference definitions, explicit delivery hours, corrections/voids, history and exports retain their behavior. Runtime duration, manual contributions and owner acceptance never book hours automatically.
- Preview/apply/undo, configuration export and full SQLite backup/restore retain their recovery boundaries. History remains attached to the original company and member identities.
- Agent Operations wording uses the recorded [branding adaptation](agent-operations/branding-receipt.json). Original import identities, role IDs and the fixed checker remain distinct from current display wording.

## Evidence and publication boundary

Record the exact source, archive checksum, isolated data directory and local URL for any review. Check empty-company creation, humans and agents, Back/cancel, stale review, uncertain-save replay, two-company switching, shared membership, reporting and ownership direction, plus existing time-entry/correction/history behavior after reload. Check desktop and 390 px layout, keyboard focus and long text. Read-only source review and retained unchanged modules are not new native browser acceptance.

The accepted local corporation-management source `ed7dda9330264a3596b0eb25a708cb3584245acf` contains product work `d2944bf601c94839405e06da0dc480209965bc23` and its two navigation corrections. The alpha.7 product incorporates that product direction alongside the published alpha.6 naming baseline. Consult [acceptance](acceptance.md) for the exact combined revision and completed checks; do not transfer the earlier local preview or release receipts to different bytes.

Published [alpha.5](https://github.com/strobl/virtual-corporation-manager/releases/tag/v0.1.0-alpha.5), published [alpha.6 branding maintenance](https://github.com/strobl/virtual-corporation-manager/releases/tag/v0.1.0-alpha.6), and alpha.5-local.1/alpha.4-local.1 interface records remain historical. Earlier alpha.3 and alpha.2 evidence retains its original identity. These archives do not contain this simplified company workspace.

Real Product Studio v2 acceptance remains open after the two 300-second intake timeouts at `ultra`, with no v2 bundle or owner acceptance; the earlier v1 download remains rejected. Native optional-work checks, live Buzz/Slack outcomes and external human usefulness remain separate. Repository merge, release publication, public installation, website deployment and domain activation require their own evidence. No additional provider attempt is implied by this product or documentation update.
