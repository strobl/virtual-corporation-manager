# Contributing

Start with a small reproducible issue or focused pull request. Explain the user problem, the resulting behavior and how you verified it. Use English for code, documentation and commits.

Use a supported Node.js version, run `npm ci`, then `npm run check`. `npm run build` builds the browser and executable; `node dist/cli.js --data-dir ./tmp-workspace --no-open` runs the actual local application. Use a fresh data directory for tests. Never commit workspace databases, credentials or task outputs.

Keep the local core usable without network or accounts. Preserve atomic configuration changes and the distinction between configured roles and real execution. New adapters must disclose prerequisites, avoid silent execution and provide actionable errors. Do not claim an external integration is operational from mocks alone.

Root maintainer: [strobl](https://github.com/strobl). GitHub issues and pull requests are the public support and contribution routes. Requirements and engineering work orders live in the dedicated 8090 project; this repository holds source, tests, reviews and release evidence. There is no paid support SLA.

Bug reports should include GitFlash/Node/OS versions, reproduction steps, expected and actual behavior and redacted diagnostics. Share sensitive vulnerabilities through the process in SECURITY.md. Do not attach a company backup to a public issue.
