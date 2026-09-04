# GitFlash

**Build a company. Put it to work.**

GitFlash is a free, open-source local workspace for a company of AI agents. Create your organization, see who owns what, and give a configured agent a concrete task. Your company, reviewed changes and actual work results live in SQLite on your computer.

This is a **technical alpha**. The local core and optional Codex execution are the first supported journey. Buzz native team import has been exercised; Buzz task dispatch and Slack round trips remain experimental. No customer or human-pilot validation is claimed.

## Install and start

Use **Node.js 24.14 or newer in the 24.x line**. Release checks cover the documented operating systems in [acceptance evidence](docs/acceptance.md). Node 26+ is also allowed; the installed package has been checked on Node 26.0.0 on macOS arm64. The cross-platform CI matrix uses Node 24.

```sh
npm install --global https://github.com/strobl/gitflash/releases/download/v0.1.0-alpha.1/gitflash-0.1.0-alpha.1.tgz
gitflash
```

GitFlash prints a loopback URL and opens your browser. If the browser does not open, visit the printed URL. Nothing needs to be deployed. The installed package includes its runtime JavaScript and browser assets; it has no npm runtime dependencies or database compiler step.

Download/install requires network access. After installation, company creation, templates, editing, organization views, preview/apply/undo and recovery work without an account or external connection. There is no mandatory Supabase, hosted authentication, billing, cloud inference or telemetry.

## Your first company

1. Choose **Create company** for a manual setup, or use a studio template with 20 or 100 differentiated roles.
2. Inspect the proposed company, departments, responsibilities and instructions. Apply the reviewed changes.
3. Use the organization tree, map, list and inspector to understand the company. Select an agent to edit its role or assignments.
4. To produce work, open **Integrations** and check an optional runtime. For Codex, install and authenticate its CLI separately, then refresh status.
5. Select an agent, choose **Run task**, describe the output you need and submit. Inspect the actual output, run ID, duration and hash in **Work**. Accept a result only after reviewing it.

Configuring 100 roles does not start 100 processes. The initial executor runs one task at a time and queues at most 20. Creating or importing a company never starts inference. Optional services use your own provider access and allowance; GitFlash does not make those services free. Read [integration setup and boundaries](docs/integrations.md).

## Safe, reviewable changes

Configuration changes have a persisted preview. Confirmation applies the reviewed batch atomically; outdated previews are refused. Repeated confirmation cannot duplicate a change. Version-aware undo preserves real work evidence and does not reverse external actions.

The company model includes departments and managers, primary and additional dated agent assignments, and separate ownership and collaboration relationships. JSON definition import validates the complete structure and creates fresh IDs. A definition carries configuration, not credentials or invented work history.

## Local data and recovery

The default data directory is `~/.gitflash`. Use `--data-dir` to keep separate workspaces, and `--port` if 4310 is occupied. Stop the running workspace before maintenance commands.

```sh
gitflash --data-dir ./my-company --port 4311 --no-open
# Stop it with Ctrl+C before maintenance:
gitflash backup --data-dir ./my-company --output ./company-backup.sqlite
gitflash restore --data-dir ./restored-company --from ./company-backup.sqlite
gitflash doctor --data-dir ./restored-company
```

Backups contain sensitive company instructions and results in plaintext SQLite. Keep them private. See [backup, restore and upgrade](docs/recovery.md), [the data model](docs/data-model.md) and [security boundaries](SECURITY.md). Do not expose the loopback server through a tunnel or proxy.

To remove the application, stop it and run `npm uninstall --global gitflash`. This leaves `~/.gitflash` and any custom data directory intact. Keep a verified backup before deliberately deleting a workspace.

## Contribute

```sh
git clone https://github.com/strobl/gitflash.git
cd gitflash
npm ci --ignore-scripts
npm run check
npm run test:package
npm start -- --data-dir ./scratch-company
```

The packaged smoke test installs the actual tarball with npm offline, creates a company and agent, applies the 100-role template, restarts and restores a backup. CI runs the checks across macOS, Linux and Windows on the minimum and latest Node 24.x. A green build is distinct from an independently observed human pilot.

Read [CONTRIBUTING](CONTRIBUTING.md), [architecture](docs/architecture.md), [release acceptance](docs/acceptance.md) and [known limitations and handoff](docs/handoff.md). Public branding is configured in `src/brand.ts`. VCM (Virtual Corporation Manager) is the internal product name.

## License and provenance

MIT for GitFlash application code. Useful organization, inspector and domain work was selectively adapted from the owner's prior prototype. The private history, hosted infrastructure and live data were excluded. Complete upstream notices for bundled dependencies and adapted component patterns are in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).
