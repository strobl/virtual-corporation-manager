# Review candidate handoff and known limits

This checkout is unpublished review candidate **0.1.0-alpha.3-local.3**, using SQLite schema **5**. It includes the delivery-hours Time Tracker, bounded Product Studio file workflows and the Little Powerhouse identity. The public alpha.2 release is a separate older artifact. Candidate source, package, platform checks and installed workflow evidence must be identified independently; see [acceptance status](acceptance.md).

The maintainer is [strobl](https://github.com/strobl). Source, issues, pull requests, CI and release artifacts live in [this repository](https://github.com/strobl/gitflash). Publication is a separate review decision. A candidate branch, green unit suite or working local preview does not by itself update the public release or landing page.

## Ownership and change process

Platform/data owns database migrations and recovery. Domain owns company invariants, templates and reviewed changes. Frontend owns coherent navigation, inspector, accessibility and product states. Integrations owns runtime process boundaries, durable receipts and external delivery. The release integrator reviews cross-module behavior and the installed artifact before tagging a release.

Use one issue or linked work order for each change. Describe the observed trigger and expected outcome, add relevant regression coverage, run the commands in [CONTRIBUTING](../CONTRIBUTING.md), then review the PR and exact-revision OS matrix. Never commit a real workspace, provider token, login store or private company output.

## Candidate acceptance still needs exact evidence

The final source revision, tarball hash, independent fresh-checkout contributor run, installed browser/Time Tracker journey and actual five-stage runtime result belong together. Their pending/completed state is recorded in [acceptance](acceptance.md); historical alpha.2 evidence does not close these gates. The configured Node 24.x/26.x platform matrix must run on the final candidate. Linux workflow-sandbox proof is separate from local-core CI, and native Windows workflow checking is unavailable.

An independent agent can execute the contributor guide and report its actual commands/results. This is an engineering contribution check, not an external human pilot or a customer's assessment of usefulness. A synthetic owner-review decision must be labelled as such.

## Open dependencies

| Dependency                                                     | Needed from                        | Required evidence                                                                                   |
| -------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Authorized Slack test app, owner/channel and local credentials | Workspace/app administrator        | Live event → runtime → correlated reply before Slack is called operational                          |
| Working Buzz installation and verified runtime/model mapping   | Buzz installation/account operator | Dispatch and signed output round trip; historical stopped-team import is insufficient               |
| External human first-company attempts                          | Founder/pilot owner                | Actual install/use observations, assistance and usefulness assessment                               |
| Public support receiving/backup arrangement                    | Maintainer and coordinating owner  | Confirmed responsibility and an observed intake/triage outcome; documentation alone is insufficient |
| Publication and campaign decision                              | Product owner                      | Review of coherent candidate, claims and destination before public release or advertising           |

Credentials stay in the operator's local environment. Do not paste them into an issue, company definition or chat. No service purchase is required for the local core.

## Limits to keep visible

- GitFlash supports one local owner and one writer per workspace. Shared/LAN hosting and multi-user authorization are unsupported.
- Configuring 100 roles starts no runtimes. One company workflow runs at a time, with three active/queued jobs allowed; the separate individual-task queue runs at most one additional task and permits 20 outstanding requests.
- Individual tasks use a read-only sandbox and return text. Company jobs use workspace-write stage directories, real files, fixed independent checking and separate role sessions. Neither sandbox is a separate OS user or a guarantee of full read isolation.
- The company workflow checks Python/sandbox capability before provider use. Its fixed checker requires macOS or Linux; native Windows support covers the local company and Time Tracker core.
- Each workflow stage is bounded to five minutes. Ordinary verified defects permit two repair candidates after the initial candidate. Severe evidence contradictions stop ordinary repair. Runtime failure has at most two explicit retries; interrupted jobs never automatically replay provider work on restart.
- Runtime completion, independent QA, explicit owner review and booked human-equivalent delivery hours are independent. Starting or accepting a workflow does not create Time Tracker entries.
- Definitions copy configuration with fresh IDs. Complete recovery uses SQLite backup, including Time Tracker history, jobs, exact artifact bytes and task receipts. Backups are plaintext and may be sensitive.
- Human pilot outcomes and live Buzz/Slack task outcomes remain separate acceptance items. Agent-operated tests cannot close them.

## Report a useful bug

Include release version, OS, Node version, steps, expected/actual behavior and whether the issue occurs in a new empty workspace. Preserve a private backup before recovery. Include a safe job/run reference and error code where relevant; redact private content and credentials. Do not upload the whole database publicly.

Use [support intake](support.md) and [recovery instructions](recovery.md). Security reports follow [SECURITY.md](../SECURITY.md). Suspected data loss and exposure take priority; preserve the affected evidence before repeating an uncertain action.
