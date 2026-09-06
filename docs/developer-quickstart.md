# Developer quickstart

Create a virtual corporation, add its people and agents, and return to manage the same organization in a later session. VCM is for one local operator; adding a human member does not create a login or shared workspace. It does not import context automatically from arbitrary IDEs and chats.

This guide accompanies **`0.1.0-alpha.7`**, the corporation-management technical prerelease. Follow [the README install block](../README.md#install-the-reviewed-archive) with the matching versioned archive and source/checksum record, or build this checkout. The commands below assume that `./vcm-preview` installation and the same working directory. Consult the release manifest for actual publication and verification. Published [alpha.6 branding maintenance](acceptance.md#branding-maintenance-release--6-september-2026) and [alpha.5 technical release](acceptance.md#technical-prerelease--6-september-2026) are historical, separate artifacts. Product Studio's actual useful-result acceptance remains open after two 300-second intake timeouts at `ultra`, with no v2 bundle or owner acceptance.

## Start and keep the same workspace

```sh
npm exec --offline --prefix ./vcm-preview -- vcm --help
npm exec --offline --prefix ./vcm-preview -- vcm --data-dir ./my-company --no-open
```

Use Node.js 24.14+ in the 24.x line, or 26.x. Open the printed `http://127.0.0.1:…` URL. Stop with Ctrl+C before maintenance. Relative paths are relative to your terminal's working directory; use an absolute `--data-dir` if you start from different directories.

The supported commands are `start` (also the default), `doctor`, `backup`, `restore`, `export` and `time-export`. There is no CLI import, `init`, `run`, YAML loader or automatic configuration watcher. `gitflash` remains an alias for the same executable and workspace behavior. Both retain `GITFLASH_DATA_DIR` and default `~/.gitflash`; the explicit flag takes precedence.

## Represent your own company

1. Open **Corporations → Create company**; the first empty workspace shows **Create your company**. Enter **Company name** and optional **Purpose**.
2. Choose **Continue**, inspect the preview, then **Create company**. **Back** retains the draft. The company opens with no generated members, work or hours.
3. Choose **Add member**. Supply a **Name** and **Role**, then choose **AI agent** or **Human**. Expand **Instructions & responsibilities** for an agent or **Working context & responsibilities** for a human. Choose **Review change → Add member**.
4. Select the saved member. Its details open alongside the company. To change a responsibility, choose **Edit member → Review change → Save member**. Back from review preserves the edited values; an existing member's type is retained.
5. Add departments only when needed using **Departments → Add**. In a member's editor, **Department & reporting line** lets you select a department and manager. **Reporting lines** shows the saved local hierarchy; it does not delegate tasks.
6. Use **Company assignments → Manage** to share one member across companies, and **Company relationships → Manage** to record company ownership or collaboration. The inspector identifies primary and shared memberships, including department context from another company. Member edits and reporting lines apply to that identity across its assignments; ownership percentages describe companies, not human shareholdings.
7. Stop the server and restart with the same data directory. Open the company from the sidebar or **Corporations**, and confirm your changes remain.

The useful outcome is a company you can find and maintain. There is no required team size or artificial hierarchy, and no task run is needed to complete setup. For the detailed map or legacy organization controls, use **Tools → Organization tools**.

## Try the three-agent example

Use [three-agent-studio.json](examples/three-agent-studio.json). It ships at `vcm-preview/node_modules/gitflash/docs/examples/three-agent-studio.json`, so no network download is needed after installation.

1. Open **Settings → Import a company definition**.
2. Choose that JSON file, or paste its full contents in **Definition JSON**.
3. Choose **Review import**. Confirm one company, one department and three agents, with the displayed responsibilities.
4. Choose **Apply changes**, then open **Corporations → Patchwork Studio (example)**.
5. Select **Builder**, **Reviewer** and **Researcher**. They are peers in **Product**. No manager is required; no work, jobs or time entries are included.

These are fictional roles for a sample release-notes tool, separate from the five-seat PS-001 runtime template. An import creates fresh IDs for every company, department, agent, assignment and company relationship. Repeating it adds another company with a suffixed short code; it does not update the first. Use **Edit company** or **Edit member** for existing records. An interrupted **Apply changes** has a **Retry save** route: confirm the same receipt instead of submitting a second import.

## Record work only when it exists

For a human’s completed contribution, choose the member’s **Record work**, enter the title and result, then review and **Apply changes**. It appears as manual work needing review under **Tools → Agent runs & records**, without a runtime ID, duration or booked hours.

To record delivery hours, choose **Log time** from the relevant company or member. Check the selected company, member, date, description and hour basis before saving. Use **Time Tracker** to inspect and, if needed, correct the entry; the original remains in history.

The company’s weekly-hours total and **Time Tracker** link open the company ledger; a member’s **Log time** opens a booking for that member. Booked delivery hours describe human-equivalent effort. They are separate from elapsed runtime, accepted results or cost savings. No entry is needed to finish setup. Use an isolated example workspace and clearly label any synthetic entry used to learn the form. [Time Tracker](time-tracker.md) contains the actual optional local API booking example and its session capability header; no credential belongs in a company definition.

## Optional agent execution

**Tools → Connections** configures optional runtimes. An AI member’s **Give a task** control requires a ready runtime and identifies the actual execution company; shared members may need to be opened in their primary company. Humans have **Record work** instead of a run control. Individual runs return read-only text. Inspect their results under **Tools → Agent runs & records**. The separate **Workflow examples** tab exposes fixed workflows with their own prerequisites. See [Product Studio](product-studio.md) for PS-001; its observed failures remain open and this guide authorizes no repeat attempt.

## Export and recovery

| Goal                                    | Existing route                                             | Contents                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Reuse or contribute a company structure | **Settings → Export company definition**, or `vcm export`  | Configuration in portable definition schema 1: companies, departments, agents, assignments and company relationships |
| Inspect booked hours                    | `vcm time-export`, or `GET /api/time/export` while running | Ledger, catalog and time history; not a full restore format                                                          |
| Recover the complete workspace          | `vcm backup` and `vcm restore` while stopped               | SQLite database, including work/jobs/artifact bytes, time/history and recovery receipts                              |

The Settings export covers the workspace's configuration, not only the selected company. Inspect it before sharing. Runtime credentials, provider login stores and installed external tools are not part of any of these exports. A full backup can contain private task inputs and outputs.

Stop VCM, then run:

```sh
npm exec --offline --prefix ./vcm-preview -- vcm export --data-dir ./my-company --output ./company-definition.json
npm exec --offline --prefix ./vcm-preview -- vcm time-export --data-dir ./my-company --output ./delivery-hours.json
npm exec --offline --prefix ./vcm-preview -- vcm backup --data-dir ./my-company --output ./company-backup.sqlite
npm exec --offline --prefix ./vcm-preview -- vcm restore --data-dir ./restored-company --from ./company-backup.sqlite
npm exec --offline --prefix ./vcm-preview -- vcm doctor --data-dir ./restored-company
npm exec --offline --prefix ./vcm-preview -- vcm --data-dir ./restored-company --no-open
```

Choose new output filenames on a repeated run; existing destinations are refused. Inspect the restored corporation, member identities and any real work/time history. Restore replaces the selected workspace rather than merging newer records. Start into a fresh `restored-company` directory for this rehearsal.

To round-trip configuration separately, stop the server and start a different empty `--data-dir ./import-check`. Import the exported JSON through Settings and inspect it. Expect new IDs and no copied work or booked hours. This is configuration reuse; use SQLite restore when original identities and history matter.

## Understand a failed change

The local server validates a complete definition before creating a preview. Unsupported fields, invalid references and reporting cycles are refused. Fix the displayed error and review again. Before confirmation, **Back** returns to a company/member draft and **Cancel** closes it without saving. Imported definitions and other reviewed changes use **Apply changes** as their confirmation.

If another tab changes the workspace, a stale preview cannot overwrite it. Review the refreshed changes. For an uncertain Apply response, use **Retry save** to resolve the same receipt; do not compensate by importing again. If the workspace is locked, stop the process using that directory before running maintenance. Never delete SQLite WAL/SHM files to clear a lock.

Full [recovery guidance](recovery.md) explains corrupt backups, retained pre-restore data, migration checksums and rollback using a compatible pre-upgrade backup. [Architecture and data](developer-architecture.md) connects these behaviors to their source modules. For help, use a [redacted reproducible issue](../CONTRIBUTING.md#review-and-support), not a public database upload.
