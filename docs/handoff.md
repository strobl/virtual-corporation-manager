# VCM corporation-first handoff and known limits

**Preparation status, 5 September 2026:** This checkout is the **unpublished corporation-first successor 0.1.0-alpha.4-local.1**, using SQLite schema **5**. It implements **Your corporations → Set up a corporation → Review changes → Apply changes → Company overview**, with real agent/reporting context and recorded delivery hours. Work execution remains optional and secondary. The package, command, environment variables and default workspace directory retain their `gitflash` identifiers; the repository is now `strobl/virtual-corporation-manager`. Public alpha.2 and the earlier frozen alpha.3 archive are separate artifacts. Identify this candidate's source, package, platform checks and browser evidence independently; see [acceptance status](acceptance.md).

The maintainer is [strobl](https://github.com/strobl). Source, issues, pull requests, CI and release artifacts live in [this repository](https://github.com/strobl/virtual-corporation-manager). Publication is a separate review decision. A candidate branch, green unit suite or working local preview does not by itself update the public release or landing page.

## Ownership and change process

Platform/data owns database migrations and recovery. Domain owns company invariants, templates and reviewed changes. Frontend owns coherent navigation, inspector, accessibility and product states. Integrations owns runtime process boundaries, durable receipts and external delivery. The release integrator reviews cross-module behavior and the installed artifact before tagging a release.

Use one issue or linked work order for each change. Describe the observed trigger and expected outcome, add relevant regression coverage, run the commands in [CONTRIBUTING](../CONTRIBUTING.md), then review the PR and exact-revision OS matrix. Never commit a real workspace, provider token, login store or private company output.

## Accepted evidence and remaining release checks

The earlier alpha.3 release manifest binds its own frozen source, archive hash and installed-package receipt. Those bytes predate this corporation-first successor. [Acceptance](acceptance.md) attributes earlier browser/data review, five-stage runtime results, contributor checks and the platform matrix to their exact revisions. This successor changes browser code, active documentation and repository metadata; its package must receive a new source/archive binding and rendered review. Existing runtime execution, Time Tracker persistence and canonical Ops source contracts are retained. No provider run is repeated or implied by the redesign.

The current UI uses the canonical corporation-frame SVG identity. Setup uses the existing definition import and atomic preview/apply path. A stale first review refreshes its base without losing the entered definition. An uncertain save retains the same preview receipt and offers **Retry save**, including after tab reload; it does not generate a new import until the server definitely rejects the original save. The new company's overview is selected against the successful preview's exact company baseline. These paths require exact-candidate browser acceptance alongside their focused recovery checks.

At this preparation snapshot, exact-release-revision CI remains pending because this local candidate is not pushed. Once publication is authorized, the existing PR must receive the reviewed successor, pass the required matrix, and bind the eventual tag and public artifact to the verified source. The public asset must then be downloaded and installed independently. A planned URL is not current availability. Publication of a release and deployment or domain activation of a website are separate actions.

Public alpha.2 uses schema 3; upgrading to alpha.3 uses the already tested migration to schema 5. Stop the old workspace and make a verified backup before upgrade. Do not open an upgraded database with the older binary; follow [recovery and rollback](recovery.md). Linux workflow-sandbox proof remains separate from local-core CI, and native Windows workflow checking is unavailable.

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

- VCM supports one local owner and one writer per workspace. Shared/LAN hosting and multi-user authorization are unsupported.
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
