# VCM — Virtual Corporation Manager

**Run a task. Review the result.**

VCM is a free, open-source local workspace. Run a task, inspect its files and evidence, track delivery hours, and manage the company behind the work. Your company, reviewed changes and actual results live in SQLite on your computer.

**Preparation status, 5 September 2026: UNPUBLISHED local release candidate `0.1.0-alpha.3`.** This candidate packages the VCM task entry screen, delivery-hours Time Tracker and Product Studio workflows for alpha.3. The current public alpha.2 release remains unchanged; it does not contain this interface, the Time Tracker or the company file workflows. At preparation, this version is not yet available as a public release. The release page and verified public download determine any later publication status. See [release notes](CHANGELOG.md) and [acceptance evidence](docs/acceptance.md) for scope and exact candidate checks.

This is a **technical alpha**. The first company job is an included synthetic Product Studio exercise that produces `stock_alert.py`, exporting `reorder_items(products)`, plus tests and review evidence. It uses fictional inventory in `input.json`; it does not connect to inventory systems or place orders. Optional Codex execution requires your own runtime access. Buzz native team import has been exercised; Buzz task dispatch and Slack round trips remain experimental. No customer or human-pilot validation is claimed.

The selected public destination is `virtualcorporationmanager.com`; domain activation and publication are not asserted here. The repository, npm package, CLI command and default data directory retain their existing `gitflash` identifiers. GitFlash's separate FDE website stays unchanged.

## Install and start

Use **Node.js 24.14+ in the 24.x line, or 26.x**. The configured acceptance matrix targets macOS, Linux and Windows on both supported release lines; see [acceptance evidence](docs/acceptance.md) for the exact source and observed results. Optional agent execution has its own [runtime prerequisites](docs/integrations.md).

The local core and Time Tracker support macOS, Linux and native Windows. The optional PS-001 company workflow requires a working macOS or Linux sandbox; its fixed checker is unavailable on native Windows. Stock Ubuntu 24.04 with its AppArmor namespace restriction is unsupported for this optional workflow and stops before provider execution. Earlier macOS and Ubuntu 22.04 sandbox evidence belongs to its recorded source; final release-candidate evidence is recorded separately.

These commands require the exact candidate archive supplied for review. They do not download a published VCM release:

```sh
npm install --offline --ignore-scripts --prefix ./gitflash-preview ./gitflash-0.1.0-alpha.3.tgz
node ./gitflash-preview/node_modules/gitflash/dist/cli.js --data-dir ./my-company
```

Use the exact supplied archive above and its matching handoff checksum, or build it from the reviewed candidate checkout with `npm ci --ignore-scripts`, `npm run check` and `npm pack`. Record the source revision and archive SHA-256: the version string alone does not identify the bytes reviewed. The isolated install does not change a global installation. For maintenance examples using `gitflash`, substitute `node ./gitflash-preview/node_modules/gitflash/dist/cli.js` if you used this isolated install.

The CLI prints a loopback URL and opens VCM in your browser. If the browser does not open, visit the printed URL. Nothing needs to be deployed. The installed package includes its runtime JavaScript and browser assets; it has no npm runtime dependencies or database compiler step.

Obtaining the archive or installing source dependencies requires network access; the supplied archive can be installed offline as shown above. After installation, company creation, templates, editing, organization views, preview/apply/undo and recovery work without an account or external connection. There is no mandatory Supabase, hosted authentication, billing, cloud inference or telemetry.

## Choose what to do

The **Home** screen has four working entry points:

| Action                   | Where it takes you                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Run a task**           | The Product Studio job form. An empty workspace first opens company templates; review and apply a template to continue.                     |
| **Review results**       | Existing company jobs or individual task results, including items waiting for your review. An empty workspace explains the next setup step. |
| **Track delivery hours** | The Time Tracker, with manual entries, reference estimates, corrections, history and analytics.                                             |
| **Set up a company**     | The company editor and its reviewed configuration change. Organization views and templates remain available.                                |

## Run the first task

1. On **Home**, choose **Run a task**. If you have no company, select **Product Studio (5 seats)** for the shortest included workflow, or the **100-agent Product Studio** for a larger organization. Review and apply the structure.
2. Review the included synthetic brief, acceptance criteria and supplied inputs in the job form. If the selected company lacks the five required roles, choose **Preview Product Studio** and review the template.
3. Name the person or responsible role who will review the result. Inspect the five roles, optional Codex/Python prerequisites and bounded execution permission, then explicitly choose **Start job**. Opening the form or applying a company template does not start execution.
4. The Delivery Manager, Requirements Analyst, Software Builder, independent Quality Reviewer and Handoff Editor create real files in separate runtime sessions. A fixed independent oracle verifies the exact candidate. Failed checks never become owner acceptance.
5. Open **Home → Review results** or **Work → Company jobs**. Download **reviewed files (.zip)**, inspect the utility and evidence, then explicitly accept or reject with a note. Follow the complete [first-company guide](docs/first-company.md) and [workflow contract](docs/product-studio.md).
6. Individual tasks remain available from an agent or **Work → Individual tasks**. They use the original read-only, text-output route with their own saved receipts.

Use **Home → Track delivery hours** to book human-equivalent delivery hours separately. The shared catalog contains 124 reference definitions; manual corrections retain their history. [Time Tracker](docs/time-tracker.md) explains the basis, overrides and local agent API. Runtime duration does not create hours.

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

Read [CONTRIBUTING](CONTRIBUTING.md), [architecture](docs/architecture.md), [release acceptance](docs/acceptance.md) and [known limitations and handoff](docs/handoff.md). The browser's VCM identity is configured in `src/web/identity.ts`; `src/brand.ts` retains the installed CLI identity. Check out the intended candidate source before evaluating unpublished behavior; the public default branch may still contain the older release.

## License and provenance

MIT for the application code. Useful organization, inspector and domain work was selectively adapted from the owner's prior prototype. Private history, hosted infrastructure and private/customer records were excluded. The Time Tracker bundles 124 owner-authorized Shared catalog definitions from the live prototype. Catalog provenance and complete upstream notices for bundled dependencies and adapted component patterns are in [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).

The retained Rubik Bold font and earlier vector assets keep their SIL OFL 1.1 attribution in `dist/web/fonts/Rubik-OFL-1.1.txt`. The VCM interface uses system fonts and native SVG assets.
