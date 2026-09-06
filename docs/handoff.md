# VCM maintainer handoff and known limits

**Technical prerelease, 6 September 2026:** [VCM alpha.5 is published](https://github.com/strobl/virtual-corporation-manager/releases/tag/v0.1.0-alpha.5) from reviewed source `7807649`, merged as `2b75b16` with an unchanged source tree. Source, PR and merge CI each passed all 17 jobs. The release manifest binds the frozen archive, source/privacy/license review and independent public-download/install/recovery record. [Current acceptance](acceptance.md#technical-prerelease--6-september-2026) supersedes the pending publication statuses in the dated preparation snapshots below. This documentation follow-up does not change the released package.

**The complete useful-result journey remains open:** both actual v2 intake attempts timed out after 300 seconds at `ultra`, with no delivery bundle or owner acceptance. The earlier v1 download remains rejected. Remaining native output/file/owner checks, live Buzz/Slack useful results and external human pilots are separate dependencies. Retain the failed runs; publication does not authorize an additional attempt or reasoning change.

**Integration checkpoint, 6 September 2026:** The retained A7 PS-001 exercise completed five actual role sessions, but the assigned technical release integrator rejected its format-1 ZIP because the downloaded tests needed the omitted `EXPECTED-REFERENCE.json` (12 pass, one error). Full recovery preserved that exact rejected download, owner decision, artifacts and request/retry records without provider replay or time booking. This is engineering evidence, not human pilot acceptance.

The format-2 correction preserves old seals and carries complete supporting files. Its final-source CI, fresh installed-provider/download/owner proof and public release verification remain pending at this checkpoint. Consult the [acceptance checkpoint](acceptance.md#integration-checkpoint--6-september-2026) and the final release manifest for the completed evidence chain. This packaged document is a dated preparation snapshot; keep final package identities in the accompanying manifest rather than rewriting source to embed its own archive hash.

**Release preparation, 5 September 2026:** This checkout targets **0.1.0-alpha.5**, using SQLite schema **5**. It continues the independently reviewed developer-first `0.1.0-alpha.5-local.1` interface: **Your corporations → Set up a corporation → Review changes → Apply changes → Company overview**, agent responsibilities and reporting context, the fictional three-agent example and recorded delivery hours. Optional work execution remains separate. The canonical command is `vcm`; `gitflash` is its compatibility alias in the existing `gitflash` package. Environment variables and the default workspace directory retain their established identifiers. The repository is `strobl/virtual-corporation-manager`. The earlier archives and their checks remain identified separately in [acceptance](acceptance.md).

The maintainer is [strobl](https://github.com/strobl). Source, issues, pull requests, CI and release artifacts live in [this repository](https://github.com/strobl/virtual-corporation-manager). The release integrator publishes only after the exact candidate's release gates pass. A candidate branch, green unit suite or working local preview does not by itself update the public release or landing page.

## Ownership and change process

Platform/data owns database migrations and recovery. Domain owns company invariants, templates and reviewed changes. Frontend owns coherent navigation, inspector, accessibility and product states. Integrations owns runtime process boundaries, durable receipts and external delivery. The release integrator reviews cross-module behavior and the installed artifact before tagging a release.

Use one issue or linked work order for each change. Describe the observed trigger and expected outcome, add relevant regression coverage, run the commands in [CONTRIBUTING](../CONTRIBUTING.md), then review the PR and exact-revision OS matrix. Never commit a real workspace, provider token, login store or private company output.

## Accepted evidence and remaining release checks

The accepted developer-first predecessor is source `bc3e6b1b5c0954f3d01764d18ea9dedfb3075733`, archive SHA-256 `c2d239f6168a61c0c6ea849d14aaf32db528e4867e72799ca57e3dea1410be9e` (775,510 bytes, 77 files). Its actual installed macOS arm64/Node 24.19.0 checks include both aliases, offline npm installation, default/custom data paths, migration from public alpha.2, complete schema-5 data and artifact preservation, backup/restore, durable receipts and removal without deleting workspaces. Independent browser review covered company creation/import/edit/restart, desktop and 390 px views, keyboard use and retained delivery-hour history. These results establish that predecessor's acceptance, not execution of a new alpha.5 release archive.

The historical 5-seat and 100-seat Product Studio jobs include five observed sessions and real checked artifacts on their recorded runtime archives. They remain separate from new package acceptance, final owner decisions and human usefulness. No provider execution is implied by a version or documentation change.

The current UI uses the canonical corporation-frame SVG identity. Setup uses the existing definition import and atomic preview/apply path. A stale first review refreshes its base without losing the entered definition. An uncertain save retains the same preview receipt and offers **Retry save**, including after tab reload; it does not generate a new import until the server definitely rejects the original save. The new company's overview is selected against the successful preview's exact company baseline. Retain the identified browser and recovery evidence, and repeat affected checks if integration changes these paths.

At this preparation snapshot, the alpha.5 final-source CI, exact archive and public-download checks remain pending. The integrator must record the reviewed source and PR, pass the required OS/Node matrix, inspect the final package allowlist, and bind the tag and public artifact to those bytes. Then download the public asset independently and follow the [documented installation](../README.md#install-the-reviewed-archive), restart and recovery route. The intended target is [v0.1.0-alpha.5](https://github.com/strobl/virtual-corporation-manager/releases/tag/v0.1.0-alpha.5), with asset `gitflash-0.1.0-alpha.5.tgz`; a planned URL is not current availability. Release publication, website deployment and domain activation are separate actions.

Public alpha.2 uses schema 3. The schema-5 successor has been tested against copied populated alpha.2 and schema-5 workspaces, including original IDs, assignments, accepted work, jobs, artifact bytes, time corrections/voids/catalog overrides and request identities. Stop the old workspace and make a verified backup before upgrade. An older binary refuses the upgraded schema; rollback uses the compatible pre-upgrade backup, as described in [recovery](recovery.md). These tests cover macOS; final-release OS execution remains its own gate.

The historical runtime parent `53d97457` passed 12 core OS/Node jobs, two actual sandbox jobs and an explicit Ubuntu 24.04 expected-refusal job. That evidence is not final alpha.5 CI. Native Windows workflow checking is unavailable; stock Ubuntu 24.04 with restricted namespaces refuses optional execution before provider dispatch.

An independent agent can execute the contributor guide and report its actual commands/results. This is an engineering contribution check, not an external human pilot or a customer's assessment of usefulness. A synthetic owner-review decision must be labelled as such.

## Open dependencies

| Dependency                                                     | Needed from                        | Required evidence                                                                                   |
| -------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| Authorized Slack test app, owner/channel and local credentials | Workspace/app administrator        | Live event → runtime → correlated reply before Slack is called operational                          |
| Working Buzz installation and verified runtime/model mapping   | Buzz installation/account operator | Dispatch and signed output round trip; historical stopped-team import is insufficient               |
| External human first-company attempts                          | Founder/pilot owner                | Actual install/use observations, assistance and usefulness assessment                               |
| Public support receiving/backup arrangement                    | Maintainer and coordinating owner  | Confirmed responsibility and an observed intake/triage outcome; documentation alone is insufficient |
| Final technical release and public install                     | Release integrator                 | Exact source/CI/tag/archive chain and an independently downloaded, installed public artifact        |
| Campaign and domain decisions                                  | Founder/marketing owner            | Separate destination, claim and distribution review; technical release does not establish adoption  |

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
