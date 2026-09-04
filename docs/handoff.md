# Technical handoff and known limits

GitFlash 0.1.0-alpha.2 is a local technical alpha. The maintainer is [strobl](https://github.com/strobl). Source, issues, pull requests, CI and release artifacts live in [this repository](https://github.com/strobl/gitflash).

## Ownership and change process

Platform/data owns database migrations and recovery. Domain owns company invariants, templates and reviewed changes. Frontend owns coherent navigation, inspector, accessibility and product states. Integrations owns runtime process boundaries, durable receipts and external delivery. The release integrator reviews cross-module behavior and the installed artifact before tagging a release.

Use one issue or linked work order for each change. Describe the observed trigger and expected outcome, add only relevant regression coverage, run `npm run check` and `npm run test:package`, then review the PR and its OS matrix. Package and source must correspond to the immutable release tag. Never commit a real workspace, provider token, login store or private company output.

## Open dependencies

| Dependency                                                                                                        | Needed from                                 | Required for                                                                            | Independent work                                                                |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Installed Slack test app with Socket Mode, allowed owner/channel and local app/bot credentials                    | Workspace/app administrator                 | Live event → GitFlash runtime → correlated reply proof before Slack is called supported | Adapter tests, clear setup, secure failure handling and local/Codex delivery    |
| Working Buzz editor, verified effective runtime and mapped public identities                                      | Existing Buzz installation/account operator | Buzz dispatch and output proof before its task route is called supported                | Native team import proof and documented snapshot export                         |
| One real person outside the implementation agents to follow the published install journey and return observations | Founder/pilot owner                         | Human-pilot acceptance                                                                  | Deliver package, reproducible tester guide and fix technically observed defects |
| Positioning/distribution feedback                                                                                 | Venture owner                               | Campaign and market-facing positioning                                                  | Publish accurate technical documentation and factual landing page               |

Credentials stay in the operator's local environment; do not paste them into an issue, company definition or chat. No additional service purchase is necessary for the local core.

## Limits to keep visible

- One local owner and one writer per workspace; shared/LAN hosting and multi-user authorization are unsupported.
- 100 differentiated configured roles demonstrate organization scale, not 100 concurrently running workers. The executor intentionally limits concurrency to one.
- A task is bounded to five minutes. A crash or uncertain external delivery is not automatically retried; inspect the record before starting a new request.
- The Codex read-only sandbox is not a separate OS user and does not guarantee that other local files are unreadable. External provider costs and privacy terms apply to submitted tasks/context.
- Definitions are configuration-only copies with fresh IDs. Complete recovery uses SQLite backup, which also contains outputs and task receipts.
- No arbitrary natural-language company generation is promised. The offline first session uses forms and reviewed templates.
- Human pilot and live Buzz/Slack task outcomes remain separate acceptance items. Agent testing cannot close them.

## Report a useful bug

Include release version, OS, Node version, steps, expected/actual behavior and whether the issue occurs in a new empty workspace. Preserve a private backup before recovery. Redact task content, personal data and all credentials. Include the run ID and error code when relevant; avoid uploading the whole database publicly.

Security reports follow [SECURITY.md](../SECURITY.md). Migration/recovery incidents take priority because they can affect user data. Use the [recovery guide](recovery.md) before manual file changes.
