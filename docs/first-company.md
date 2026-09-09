# Your first corporation

Create a company, add its people and agents, and keep their responsibilities attached to the same organization. Agent execution is optional. Adding a human member records a person in the local company; it does not create a user account or shared login.

## Install VCM

This guide accompanies the **`0.1.0-alpha.11` technical alpha**. The [README](../README.md#install-vcm) records the installation route. Earlier releases retain their own artifacts and acceptance evidence.

Use Node.js **24.14+ within 24.x, or 26.x**, with npm:

```sh
npx virtualcorporationmanager
```

For a permanent installation:

```sh
npm install -g virtualcorporationmanager
vcm
```

Open the local URL printed in the terminal. Stop with Ctrl+C and run the same command to return to your corporation. The workspace defaults to `~/.gitflash`; existing `GITFLASH_DATA_DIR` settings are retained. Add `--port 4311` if the default port is occupied. For a separate learning workspace after a permanent install, use `vcm --data-dir ./vcm-first-company` and restart from the same working directory with that path.

For verified offline archives or an older global installation, use the [advanced installation instructions](../README.md#install-the-reviewed-archive) and [compatibility guide](branding.md). After a permanent install, include `vcm --version` with any support report; this release prints `0.1.0-alpha.11`.

## Create and return to your company

1. Open **Corporations → Create company**. In an empty workspace the button is **Create your company**.
2. Enter **Company name** and optional **Purpose**. Choose **Continue**. The review describes an empty team; VCM supplies the internal code and color.
3. Choose **Create company** to save. **Back** preserves the draft, and **Cancel** before confirmation creates nothing. The saved company opens immediately.
4. Choose **Add member**, enter a **Name** and **Role**, and select **AI agent** or **Human**. Expand the responsibilities section when useful. Choose **Review change → Add member**.
5. Select the member in the company roster. Its details open beside the company. Choose **Edit member**, change a responsibility, then **Review change → Save member**. **Back** from review preserves the edited values. Editing does not switch an existing member between human and agent.
6. Stop and restart with the same command. Open the company from the sidebar or **Corporations**. Verify the member and responsibility remain.

One useful member is enough. You can also import the [fictional three-agent example](examples/README.md) through **Settings → Import a company definition**. Imports create fresh identities and preserve existing companies; repeated import does not update a prior company.

If another window changes the workspace, review the refreshed preview before saving. If a save response is interrupted, use **Retry save** to confirm the same receipt; do not create another company or import. The pending receipt remains in the tab for recovery after reload. See [failed-change and recovery guidance](developer-quickstart.md#understand-a-failed-change).

## Add structure when needed

Use **Departments → Add** to create a department. In a member's editor, expand **Department & reporting line** to choose its department and manager. **Reporting lines** shows relationships inside the current company; reporting does not automatically delegate work.

In a member's details, **Company assignments → Manage** adds or changes company membership without creating another identity. The inspector distinguishes primary and shared memberships and names another company's department when applicable. Responsibilities and reporting apply to the member across its assignments.

**Company relationships → Manage** records ownership or collaboration between companies. The company page separates **Owned by** from **Owns**. These percentages are company relationships, not human shareholdings or a legal cap table. **Tools → Organization tools** retains the detailed map and organization controls.

## Keep contributions and hours separate

A human can use **Record work** to enter a completed contribution, then review and **Apply changes**. The result appears as manual work needing review in **Tools → Agent runs & records**. It has no runtime ID or duration and books no hours.

Choose **Log time** from the company or a member's details only when there are delivery hours to record. Confirm the company, member, date, description and explicit hours or reference-estimate basis before saving. The existing **Time Tracker** retains weekly entries, multiple entries per day, corrections, void history, analytics and exports. The company-hours link opens the whole company ledger; member **Log time** keeps that member preselected.

These are human-equivalent delivery hours, separate from model duration or accepted results. Setup, manual work records and owner acceptance never create hours automatically. See [Time Tracker](time-tracker.md). For configuration export and full SQLite backup/restore, follow the [quickstart recovery steps](developer-quickstart.md#export-and-recovery).

## Optional execution

**Tools → Connections** manages optional runtimes. An AI member's **Give a task** control starts a separately confirmed task through a ready runtime and returns text for review. Humans have no execution control. The **Workflow examples** tab under **Tools → Agent runs & records** contains the fixed Product Studio example, with its own role, provider and sandbox requirements.

The [Product Studio guide](product-studio.md) contains the complete PS-001 brief, files, checks and owner-review contract. Its current v2 intake and one retry each timed out after 300 seconds at `ultra`; no v2 bundle or owner acceptance exists. The earlier v1 download remains rejected for its missing expected-reference file. Neither setup nor this guide authorizes another attempt or a reasoning change. Live Buzz/Slack useful-result acceptance and external human usefulness remain separate open evidence.

## Get help

Use the [support instructions](support.md). Keep the source/checksum, version, failing step, expected/actual behavior and a minimal synthetic reproduction. Include a job reference only when the problem concerns a run. Do not upload a whole workspace, credentials, provider login files or private work; suspected security exposure belongs in private security reporting.
