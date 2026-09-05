# Contributing

A contribution starts with a small reproducible issue or focused pull request. Explain the user problem, the resulting behavior and your verification. Use English for code, documentation and commits.

## Fresh checkout

Install Git and Node.js **24.14+ in the 24.x line, or 26.x**. A contributor needs network access for the initial checkout and dependency download. Python and a Codex account are optional; neither is required for the local configuration, Time Tracker or test suite.

```sh
git clone https://github.com/strobl/gitflash.git
cd gitflash
npm ci --ignore-scripts
npm run check
npm run format:check
npm run test:package
```

For a pull request or review candidate, check out its supplied branch or commit after `cd gitflash` and before `npm ci`. Record `git rev-parse HEAD` with your results. `npm run check` checks types, runs the tests and builds the CLI and browser. `npm run test:package` installs the real tarball into a temporary directory and exercises the documented local journey, persistence, recovery and Time Tracker. CI is configured to run type/test/build and packaged acceptance on macOS, Linux and Windows with minimum/current Node 24.x and 26.x. Check the exact revision's results in [acceptance evidence](docs/acceptance.md); configuration alone is not a passing matrix. Mock workflow tests exercise failure and recovery; they are not evidence of a live provider run.

## Try your build

```sh
node dist/cli.js --data-dir ./tmp-workspace --no-open
```

Open the loopback URL printed in the terminal. Create a company from a template and inspect its roles. Open **Time Tracker**, add a synthetic delivery-hours entry, change it and inspect its history. These hours are explicit human-equivalent bookkeeping, separate from runtime duration. Stop with Ctrl+C, rerun the command and verify the company and entry remain.

The **Product Studio (5 seats)** and **100-agent Product Studio** templates include the roles for **Work → Company jobs → Set up first job → Start job**. The optional runtime creates a small Python utility as actual files, with independent review and an explicit owner decision. Native Windows supports the local core and Time Tracker; the workflow checker requires macOS or Linux, with exact platform evidence tracked separately. Follow [the first-company guide](docs/first-company.md) and [workflow contract](docs/product-studio.md) for prerequisites and execution permissions. Never run arbitrary contributed code against a personal workspace or confidential inputs.

## Keep changes reviewable

Keep the local core usable without accounts or network. Preserve atomic configuration changes, migration checksums, full backups and the distinction between configured roles and real execution. Use fresh temporary workspaces for tests; never commit databases, credentials or task outputs. Existing migration statements are immutable: add a new numbered migration for schema changes.

Adapters must disclose prerequisites, restrict execution, preserve observed evidence and produce actionable errors. Do not mark external integrations operational based on mocks. Runtime completion, independent QA, owner acceptance and delivery-hours entries are separate facts.

## Review and support

Open a pull request with a concrete before/after description and the commands you ran. The maintainer reviews scope, correctness, checks and user-facing behavior before merging. Release artifacts are installed and checked again; a successful development build alone is insufficient.

Root maintainer: [strobl](https://github.com/strobl). [GitHub issues](https://github.com/strobl/gitflash/issues) are the public bug and support intake; pull requests are the contribution route. There is no paid support SLA. Include GitFlash/Node/OS versions, steps, expected versus actual behavior and redacted diagnostics. The maintainer triages whether the report is an install problem, product defect, optional runtime issue or enhancement; urgent data loss and security reports take priority. Use [private security reporting](SECURITY.md) for sensitive vulnerabilities. Do not attach a company backup to a public issue.

Requirements and work orders live in the dedicated 8090 project; this repository holds source, tests, reviews and release evidence. External human pilot feedback and maintainer support response are tracked separately from contributor command checks.
