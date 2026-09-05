# VCM — Virtual Corporation Manager

**Set up your virtual corporation.**

Create agents, define reporting lines and log delivery hours in one place. VCM is a free, open-source local workspace for your corporations, departments and agents. Your company configuration, reviewed changes and recorded work live in SQLite on your computer.

**Preparation status, 5 September 2026: UNPUBLISHED corporation-first candidate `0.1.0-alpha.4-local.1`.** This checkout implements the corporation setup and overview journey described below, alongside the existing Time Tracker and optional Product Studio workflows. The public alpha.2 release remains an older artifact; it does not contain this interface, the Time Tracker or the company file workflows. An earlier alpha.3 archive also predates this redesign. Use the supplied candidate's exact source revision and checksum; the version string alone does not identify its interface. The release page and verified public download determine any later publication status. See [acceptance evidence](docs/acceptance.md) and [UI review scope](docs/vcm-ui-preview.md).

The repository is [strobl/virtual-corporation-manager](https://github.com/strobl/virtual-corporation-manager). The npm package, CLI command, environment variables and default data directory keep their `gitflash` identifiers. The selected public destination is `virtualcorporationmanager.com`; domain activation is not asserted here. GitFlash's separate FDE website stays unchanged.

## Install and start

Use **Node.js 24.14+ in the 24.x line, or 26.x**. The configured acceptance matrix targets macOS, Linux and Windows on both supported release lines; see [acceptance evidence](docs/acceptance.md) for the exact source and observed results. Optional agent execution has its own [runtime prerequisites](docs/integrations.md).

The local core and Time Tracker support macOS, Linux and native Windows. The optional PS-001 company workflow requires a working macOS or Linux sandbox; its fixed checker is unavailable on native Windows. Stock Ubuntu 24.04 with its AppArmor namespace restriction is unsupported for this optional workflow and stops before provider execution. Earlier macOS and Ubuntu 22.04 sandbox evidence belongs to its recorded source; final release-candidate evidence is recorded separately.

These commands require the exact candidate archive supplied for review. They do not download a published VCM release:

```sh
npm install --offline --ignore-scripts --prefix ./gitflash-preview ./gitflash-0.1.0-alpha.4-local.1.tgz
node ./gitflash-preview/node_modules/gitflash/dist/cli.js --data-dir ./my-company
```

Use the exact supplied archive above and its matching handoff checksum, or build it from the reviewed candidate checkout with `npm ci --ignore-scripts`, `npm run check` and `npm pack`. Record the source revision and archive SHA-256: the version string alone does not identify the bytes reviewed. The isolated install does not change a global installation. For maintenance examples using `gitflash`, substitute `node ./gitflash-preview/node_modules/gitflash/dist/cli.js` if you used this isolated install.

The CLI prints a loopback URL and opens VCM in your browser. If the browser does not open, visit the printed URL. Nothing needs to be deployed. The installed package includes its runtime JavaScript and browser assets; it has no npm runtime dependencies or database compiler step.

Downloading a release, cloning the repository or obtaining uncached source dependencies requires network access; the supplied archive can be installed offline as shown above. After installation, company creation, templates, editing, organization views, preview/apply/undo and recovery work without an account or external connection. There is no mandatory Supabase, hosted authentication, billing, cloud inference or telemetry.

## Set up your corporation

1. Open **Your corporations** and choose **Set up a corporation**. Give the corporation a name, short code and optional purpose.
2. Start with an empty structure or choose **Use small team** for two editable departments and three agents. Add or edit names, roles, departments, reporting relationships, responsibilities and instructions.
3. Review the identity and structure, then choose **Review changes**. The server validates the definition and presents the resulting changes. **Apply changes** saves them together and opens the new **Company overview**. Back keeps the entered fields; cancelling or discarding before Apply creates no company.
4. Use **Add agent**, **Add department** and **Manage organization** to maintain the real team. Selecting an agent exposes its company, department and manager context, plus its responsibilities and instructions. Reporting lines and company ownership are separate relationships.
5. Choose **Log time** from the company or agent context to open the delivery-hours form. Saving an entry is explicit. **Time Tracker** provides the weekly ledger, reference estimates, corrections, history and analytics.

Returning to **Your corporations** shows the saved corporations with agent/department counts and current-week recorded hours. Opening a corporation selects its own overview and hours. An empty corporation has a direct path to add its first agent; it has no invented work or activity.

The shared Time Tracker catalog contains 124 reference definitions. Its human-equivalent delivery hours describe booked effort, with explicit, catalog or fallback-estimate basis. Runtime duration and accepting a result never create hours. Follow the [first-company guide](docs/first-company.md) and [Time Tracker guide](docs/time-tracker.md).

## Optional work execution

Company setup requires no VCM account or provider connection. **Work** and **Integrations** provide separate optional execution paths after the corporation exists.

The included **Product Studio (5 seats)** and **100-agent Product Studio** templates are available from **Your corporations → Browse company templates**, and from **Organization → Templates**. Review and apply one to create its company, then open **Work → Company jobs → Set up first job**. Review the synthetic brief, five required roles and prerequisites; name the acceptance owner and explicitly choose **Start job**. Opening the form or applying a template does not start execution.

The PS-001 exercise produces `stock_alert.py`, exporting `reorder_items(products)`, plus tests and review evidence. It uses fictional inventory in `input.json`; it does not connect to inventory systems or place orders. Inspect the exact artifacts and QA record in **Work → Company jobs**, download the reviewed files, and separately accept or reject the result with a note. Individual read-only text tasks remain available from an agent or **Work → Individual tasks**. See the [workflow contract](docs/product-studio.md).

Configuring 100 roles does not start 100 processes. One company workflow runs at a time with at most three active/queued jobs. Its roles execute sequentially; the separate individual-task queue supports one additional active task and at most 20 outstanding tasks. Optional Codex execution requires your own runtime access and allowance. Buzz native team import has been exercised; Buzz task dispatch and Slack round trips remain experimental. No customer or human-pilot validation is claimed. [Integration setup and boundaries](docs/integrations.md) identifies the supported and experimental paths.

## Safe, reviewable changes

Configuration changes have a persisted preview. Confirmation applies the reviewed batch atomically; outdated previews are refused. A stale first review refreshes the workspace revision while keeping the entered definition. If an Apply response is interrupted, **Retry save** confirms the same preview receipt; refreshing or discarding that uncertain save is blocked until its outcome is known. The tab retains the receipt for recovery after a reload. Repeating that same receipt does not duplicate a change. Version-aware undo preserves real work evidence and does not reverse external actions.

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
git clone https://github.com/strobl/virtual-corporation-manager.git
cd virtual-corporation-manager
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
