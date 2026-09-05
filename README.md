# GitFlash

**Review candidate `0.1.0-alpha.3-local.3`.** This package includes the delivery-hours Time Tracker, real Product Studio file workflows and the Little Powerhouse identity. It is awaiting release review. The public alpha.2 release remains a separate older version and does not contain these features.

**Build a company. Put it to work.**

GitFlash is a free, open-source local workspace for a company of AI agents. Create your organization, see who owns what, and give a configured agent a concrete task. Your company, reviewed changes and actual work results live in SQLite on your computer.

This is a **technical alpha**. The local core and optional Codex execution are the first supported journey. Buzz native team import has been exercised; Buzz task dispatch and Slack round trips remain experimental. No customer or human-pilot validation is claimed.

## Install and start

Use **Node.js 24.14+ in the 24.x line, or 26.x**. The configured acceptance matrix targets macOS, Linux and Windows on both supported release lines; final candidate CI is pending, see [acceptance evidence](docs/acceptance.md) for the exact candidate results. Optional agent execution has its own [runtime prerequisites](docs/integrations.md).

```sh
npm install --offline --ignore-scripts --prefix ./gitflash-preview ./gitflash-0.1.0-alpha.3-local.3.tgz
node ./gitflash-preview/node_modules/gitflash/dist/cli.js --data-dir ./my-company
```

Use the exact supplied archive above, or build it from the candidate branch with `npm ci --ignore-scripts`, `npm run check` and `npm pack`. The isolated install does not change a global installation. For maintenance examples using `gitflash`, substitute `node ./gitflash-preview/node_modules/gitflash/dist/cli.js` if you used this isolated install.

GitFlash prints a loopback URL and opens your browser. If the browser does not open, visit the printed URL. Nothing needs to be deployed. The installed package includes its runtime JavaScript and browser assets; it has no npm runtime dependencies or database compiler step.

Download/install requires network access. After installation, company creation, templates, editing, organization views, preview/apply/undo and recovery work without an account or external connection. There is no mandatory Supabase, hosted authentication, billing, cloud inference or telemetry.

## Your first company

1. Choose **Explore templates → Product Studio (5 seats)** for the shortest real workflow, or the **100-agent Product Studio** for a larger organization. Review and apply the structure.
2. Open **Time Tracker** to book human-equivalent delivery hours, use the shared reference catalog, correct entries and inspect their history and analytics. [Time Tracker](docs/time-tracker.md) explains the basis, overrides and local agent API. Runtime duration does not create hours.
3. In **Work → Company jobs**, select **Set up first job**. Name the person or responsible role who will review the result, then inspect the five roles, optional Codex/Python prerequisites and bounded execution permission, then choose **Start job**.
4. The Delivery Manager, Requirements Analyst, Software Builder, independent Quality Reviewer and Handoff Editor create real files in separate runtime sessions. A fixed independent oracle verifies the exact candidate. Failed checks never become owner acceptance.
5. Download **reviewed files (.zip)**, inspect the utility and evidence, then explicitly accept or reject with a note. Follow the complete [first-company guide](docs/first-company.md) and [workflow contract](docs/product-studio.md).
6. Individual tasks remain available from an agent or **Work → Individual tasks**. They use the original read-only, text-output route with their own saved receipts.

Configuring 100 roles does not start 100 processes. One company workflow runs at a time with at most three active/queued jobs. Its roles execute sequentially; the separate individual-task queue supports one additional active task and at most 20 outstanding tasks. Creating or importing a company never starts inference. Optional services use your own access and allowance. [Integration setup and boundaries](docs/integrations.md) distinguishes this supported route from deferred Buzz/Slack evidence.

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

To remove the application, stop it and run `npm uninstall --prefix ./gitflash-preview gitflash`. This leaves `~/.gitflash` and any custom data directory intact. Keep a verified backup before deliberately deleting a workspace.

## Contribute

```sh
git clone https://github.com/strobl/gitflash.git
cd gitflash
npm ci --ignore-scripts
npm run check
npm run test:package
npm start -- --data-dir ./scratch-company
```

The packaged smoke test installs the actual tarball with npm offline, creates a company and agent, applies the 100-role template, restarts and restores a backup. CI is configured for macOS, Linux and Windows on the minimum and latest Node 24.x and 26.x; consult the candidate evidence for observed results. A green build is distinct from an independently observed human pilot.

Read [CONTRIBUTING](CONTRIBUTING.md), [architecture](docs/architecture.md), [release acceptance](docs/acceptance.md) and [known limitations and handoff](docs/handoff.md). Public branding is configured in `src/brand.ts`. Virtual Corporation Manager is the visible product descriptor; GitFlash is the public brand.

## License and provenance

MIT for GitFlash application code. Useful organization, inspector and domain work was selectively adapted from the owner's prior prototype. Private history, hosted infrastructure and private/customer records were excluded. The Time Tracker bundles 124 owner-authorized Shared catalog definitions from the live prototype. Catalog provenance and complete upstream notices for bundled dependencies and adapted component patterns are in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

The bundled Rubik Bold font and approved vector wordmark retain their SIL OFL 1.1 attribution in `dist/web/fonts/Rubik-OFL-1.1.txt`. The public product name remains GitFlash; Virtual Corporation Manager is its visible descriptor.
