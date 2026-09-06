# Contributing

A contribution starts with a small reproducible issue or focused pull request. Explain the user problem, resulting behavior and verification. Use English for code, documentation and commits. Everything needed to understand a public contribution must be in the issue and repository; an internal 8090 reference is optional. No private planning access or paid provider account is required for local-core work.

Review [the concrete singular/plural contribution exercise](docs/contribution-exercise.md), choose a [bounded starter task](docs/developer-contributing.md), inspect the [architecture map](docs/developer-architecture.md), or adapt the [three-agent example](docs/examples/README.md). These local task briefs are preparation, not claims that GitHub issues or community contributions already exist.

## Fresh checkout

Install Git and Node.js **24.14+ in the 24.x line, or 26.x**. A contributor needs network access for the initial checkout and dependency download. Python and a Codex account are optional; neither is required for the local configuration, Time Tracker or test suite.

```sh
git clone https://github.com/strobl/virtual-corporation-manager.git
cd virtual-corporation-manager
npm ci --ignore-scripts
npm run check
npm run format:check
npm run test:package
```

For the frozen `0.1.0-alpha.5` release, obtain the exact revision from its [versioned release](https://github.com/strobl/virtual-corporation-manager/releases/tag/v0.1.0-alpha.5). The default branch may contain later documentation or development changes. For a release, pull request or review candidate, check out its recorded tag or commit after `cd virtual-corporation-manager` and before `npm ci`. Record `git rev-parse HEAD` with your results. `npm run check` checks types, runs the tests and builds the CLI and browser. `npm run test:package` installs the real tarball into a temporary directory and exercises the documented local journey, persistence, recovery and Time Tracker. CI is configured to run type/test/build and packaged acceptance on macOS, Linux and Windows with minimum/current Node 24.x and 26.x. Check the exact revision's results in [acceptance evidence](docs/acceptance.md); configuration alone is not a passing matrix. Mock workflow tests exercise failure and recovery; they are not evidence of a live provider run.

## Try your build

```sh
node dist/cli.js --data-dir ./tmp-workspace --no-open
```

Open the printed loopback URL. Follow [the developer quickstart](docs/developer-quickstart.md): save a corporation for your own project, add useful roles, stop and reopen the workspace, then edit and verify one responsibility. A reporting manager is optional. Record time only if real work exists; synthetic learning entries belong in an isolated workspace and must be labeled. An example or agent-run test is not an external developer pilot.

For a provider-free, executable example check:

```sh
node docs/examples/verify.mjs
```

It starts the built CLI in a temporary workspace and verifies the real JSON import/preview/apply, edited configuration, restart, export, fresh-ID reimport and SQLite recovery. It creates no jobs or time entries. The same script ships in the installed package, beside its example, and can verify that exact installation. [Example instructions](docs/examples/README.md) explain how to check a proposed fixture.

The optional **Product Studio (5 seats)** and **100-agent Product Studio** templates are available from **Your corporations → Browse company templates** or **Organization → Templates**. They include the roles for **Work → Company jobs → Set up first job → Start job**. The optional runtime creates a small Python utility as actual files, with independent review and an explicit owner decision. Native Windows supports the local core and Time Tracker; the workflow checker requires macOS or Linux, with exact platform evidence tracked separately. Follow [the first-company guide](docs/first-company.md) and [workflow contract](docs/product-studio.md) for prerequisites and execution permissions. Never run arbitrary contributed code against a personal workspace or confidential inputs.

## Keep changes reviewable

Keep the local core usable without accounts or network. Preserve atomic configuration changes, migration checksums, full backups and the distinction between configured roles and real execution. Use fresh temporary workspaces for tests; never commit databases, credentials or task outputs. Existing migration statements are immutable: add a new numbered migration for schema changes.

Adapters must disclose prerequisites, restrict execution, preserve observed evidence and produce actionable errors. Do not mark external integrations operational based on mocks. Runtime completion, independent QA, owner acceptance and delivery-hours entries are separate facts.

## Review and support

Open a pull request with a concrete before/after description and the commands you ran. The maintainer reviews scope, correctness, checks and user-facing behavior before merging. Release artifacts are installed and checked again; a successful development build alone is insufficient.

Root maintainer: [strobl](https://github.com/strobl). [GitHub issues](https://github.com/strobl/virtual-corporation-manager/issues) are the public bug and support intake; pull requests are the contribution route. There is no paid support SLA. Include the VCM package version (`vcm --version`, or the documented isolated `npm exec` invocation), Node and OS versions, steps, expected versus actual behavior and redacted diagnostics. The maintainer triages whether the report is an install problem, product defect, optional runtime issue or enhancement; urgent data loss and security reports take priority. Use [private security reporting](SECURITY.md) for sensitive vulnerabilities. Do not attach a company backup to a public issue.

The maintainer mirrors internal requirements in 8090. Contributors do not need access: put the complete problem, scope, reproduction and acceptance in the GitHub issue or PR. An 8090 ID may be added as an optional cross-reference, never as the sole specification. External human pilot feedback and actual maintainer response are tracked separately from automated contributor checks. No response-time SLA is promised.

## Contribution licensing

Contributions intended for the VCM core are submitted under the [MIT License](LICENSE). You retain your copyright; routine MIT core contributions require no copyright assignment or separate contributor license agreement. Submit only material you are authorized to contribute and identify third-party sources, licenses and notices. Work on any separately licensed Enterprise component requires an explicit agreement for that component before acceptance. See the [licensing model](docs/licensing.md).
