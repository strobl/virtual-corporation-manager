# Developer quickstart

Build a persistent organization for one of your projects, then inspect and change it in a later session. VCM is for a local operator; it does not share a workspace between logged-in teammates or import context automatically from arbitrary IDEs and chats.

This guide targets the unpublished `0.1.0-alpha.5-local.1` candidate. Start with its exact supplied archive and matching source/checksum receipt. The public alpha.2 release is an earlier product. Follow [the README install block](../README.md#install-the-local-candidate) first; these commands assume the same `./vcm-preview` installation and working directory.

## Start and keep the same workspace

```sh
npm exec --offline --prefix ./vcm-preview -- vcm --help
npm exec --offline --prefix ./vcm-preview -- vcm --data-dir ./my-company --no-open
```

Use Node.js 24.14+ in the 24.x line, or 26.x. Open the printed `http://127.0.0.1:…` URL. Stop with Ctrl+C before maintenance. Relative paths are relative to your terminal's working directory; use an absolute `--data-dir` if you start from different directories.

The supported commands are `start` (also the default), `doctor`, `backup`, `restore`, `export` and `time-export`. There is no CLI import, `init`, `run`, YAML loader or automatic configuration watcher. `gitflash` remains an alias for the same executable and workspace behavior. Both retain `GITFLASH_DATA_DIR` and default `~/.gitflash`; the explicit flag takes precedence.

## Try the three-agent example

Use [three-agent-studio.json](examples/three-agent-studio.json). It ships in the archive at `vcm-preview/node_modules/gitflash/docs/examples/three-agent-studio.json`, so the example needs no network download after installation.

1. Open **Settings → Import a company definition**.
2. Choose that JSON file, or paste its full contents in **Definition JSON**.
3. Choose **Review import**. Confirm one corporation, one department and three agents, with the displayed responsibilities. Importing is an explicit preview/apply operation.
4. Choose **Apply changes**, then open **Your corporations → Patchwork Studio (example)**.
5. Inspect **Builder**, **Reviewer** and **Researcher**. All three are peers in **Product**. No manager is required. The example contains no work, jobs or time entries.

These are fictional roles for a sample release-notes tool. Their instructions describe potential outputs; no output has been generated or accepted. The definition is not the five-seat PS-001 runtime template.

An import creates new identities for every company, department, agent, assignment and company relationship. Repeating the import creates another corporation with a suffixed short code; it does not update the first. Use the existing company's edit controls for changes. An interrupted **Apply** has its own **Retry save** recovery route: confirm the same receipt instead of submitting a second import.

## Represent your own project

Return to **Your corporations → Set up a corporation**. Use your actual project name, purpose and current agent roles. You can start empty and add one useful agent, or edit the small-team starting point. Specify what each agent owns and what information it needs. Add a department or manager only when it matches your work.

Choose **Review changes → Apply changes**. Stop the server, restart with the same data directory and open your saved corporation. Select an agent, use **Edit details**, change one responsibility or instruction, review and apply. Reload and check that the change remains.

The useful outcome is a project configuration you can find and maintain, not a required number of agents or an artificial hierarchy. Compare this with the role document or script you used before. A saved example and an automated QA run do not establish activation or repeat use by an external developer.

## Record work only when it exists

If you have work to record, choose **Log time** from the relevant corporation or agent. Check the selected company, member, date, description and hour basis before saving. Use **Time Tracker** to inspect and, if needed, correct the entry; the original remains in history.

Booked delivery hours describe human-equivalent effort. They are separate from elapsed runtime, accepted results or cost savings. No entry is needed to finish setup. Use an isolated example workspace and clearly label any synthetic entry used to learn the form. [Time Tracker](time-tracker.md) contains the actual optional local API booking example and its session capability header; no credential belongs in a company definition.

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

The local server validates a complete definition before creating a preview. Unsupported fields, invalid references and reporting cycles are refused. Fix the displayed error and review again. Cancelling before Apply does not save an organization.

If another tab changes the workspace, a stale preview cannot overwrite it. Review the refreshed changes. For an uncertain Apply response, use **Retry save** to resolve the same receipt; do not compensate by importing again. If the workspace is locked, stop the process using that directory before running maintenance. Never delete SQLite WAL/SHM files to clear a lock.

Full [recovery guidance](recovery.md) explains corrupt backups, retained pre-restore data, migration checksums and rollback using a compatible pre-upgrade backup. [Architecture and data](developer-architecture.md) connects these behaviors to their source modules. For help, use a [redacted reproducible issue](../CONTRIBUTING.md#review-and-support), not a public database upload.
