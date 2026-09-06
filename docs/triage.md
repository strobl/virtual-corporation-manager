# VCM support triage

This guide covers company setup, team management, delivery-hours and optional Product Studio reports. The [first-company guide](first-company.md) begins at **Corporations → Create your company** in an empty workspace, or **Create company** in the company list. A name and optional purpose are followed by **Continue → Create company**; the saved overview supports **Add member** for agents and people. Follow the [README installation route](../README.md#install-the-reviewed-archive) and record the source/archive identity as well as the `vcm --version` output; builds with the same version string may contain different source.

For the optional native PS-001 workflow, select the intended company and open **Tools → Agent runs & records → Workflow examples → Set up example → Start job** for a Product Studio with the required roles. **Preview Product Studio** offers reviewed example-company creation when those roles are missing. The acceptance owner and start authority are captured with the job; final acceptance remains a separate decision. Candidate files are created by that workflow and delivered through its artifact bundle. **Version:** `0.1.0-alpha.7`; exact installed-package and rendered acceptance is tracked separately in [acceptance](acceptance.md). Alpha.5 and alpha.6 evidence is historical.

Retain the observed Product Studio failures as separate evidence: v2 intake and its one retry timed out after 300 seconds each at `ultra`, leaving no v2 bundle or owner acceptance. The earlier v1 download remains rejected for its missing expected-reference file. Do not turn a documentation or setup report into a new provider attempt or reasoning change; consult the exact [acceptance record](acceptance.md).

A stale initial setup review must retain the entered definition. An uncertain create, member-save or import-apply outcome must retain and retry the same preview receipt; do not recommend a fresh import until the original save has been confirmed or definitely rejected. For hours reports, identify the selected company/member, entry, date, basis and correction/void history separately from any runtime record.

## Intake and responsibility

Use [VCM Issues](https://github.com/strobl/virtual-corporation-manager/issues) for appropriate public reports and [private vulnerability reporting](https://github.com/strobl/virtual-corporation-manager/security/advisories/new) for suspected vulnerabilities. The included [support guide](support.md) defines the minimal redacted report. Public replies require an authorized maintainer.

The repository's administrative maintainer is `strobl`. A named operational receiving person and backup/escalation arrangement for this release have not been confirmed. The functions below describe responsibility; they are not claims of actual GitHub assignment, staffed capacity or an on-call commitment. PMO must confirm the receiver and backup with the maintainer before claiming operational coverage. No paid-support SLA or response deadline is promised.

| Report category                                                                                                                     | Next responsible function                                                   | Minimal handoff                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Brief, role, acceptance criterion, source/proof distinction or guide wording                                                        | Agent Operations                                                            | Exact installed guide/task version, disputed text, affected criterion and proposed clarification                                                     |
| Installation, missing UI control/role mapping, runtime, candidate files, artifact download, saved state or acceptance-record defect | VP Engineering                                                              | Release/OS/Node/runtime versions, failing step, smallest synthetic reproduction or discrepancy, safe job/candidate references and preservation state |
| Pilot eligibility, assistance, priority, additional-run permission or participant disposition                                       | PMO                                                                         | Affected attempt, assistance and impact, available options and required decision; exclude private account details                                    |
| Suspected vulnerability or exposure                                                                                                 | Engineering through private vulnerability reporting; PMO coordinates impact | Minimal private reproduction, preservation state and impact; no public sensitive attachment                                                          |
| Possible data loss or recovery problem                                                                                              | Engineering through the release's recovery process; PMO coordinates impact  | Last safe state and recovery already attempted; keep the workspace/backup private                                                                    |
| Unclear category                                                                                                                    | PMO names one next function                                                 | Available evidence and one consolidated gap list; prevent conflicting parallel requests                                                              |

## Handle evidence and permissions

Keep one report per distinct symptom and one accountable next function. The first receiver checks the exact version, expected/actual behavior, affected step and redacted evidence. Ask for the smallest missing items once in a consolidated request, within the task's explicit permission. Do not request an entire workspace, private history, credentials or an unnecessary rerun.

A reported behavior without corroborating candidate inspection or a reliable exact-version result remains unverified; the functional check is NOT RUN. If a required evidence packet is absent or incomplete, record that completeness failure and name the missing items. An absent log does not prove deliberate falsification. Different role or seat names do not prove independent execution; retain actual producer/reviewer execution evidence separately.

An authoritative same-version failing transcript that contradicts PASS, or an authoritative owner ledger that contradicts claimed acceptance, requires an immediate stop of affected work, evidence preservation and manager/owner disposition. It does not permit automatic ordinary repair.

For ordinary defects, follow the actual job authorization and the narrower permission for the current action. Count consolidated evidence requests separately from executed repair candidates. One evidence request permits no code change unless separately authorized. An exhausted or absent allowance means a hold with the accountable manager. A global maximum of two repairs is a ceiling, not authority or a reset mechanism.

## Labels, priority and closure

Use existing labels when applicable: `question` for clarification or missing evidence, `documentation` for a guide correction, `bug` for a triaged product defect or suspected defect, and `accessibility` for an accessibility barrier. A label does not prove reproduction or assignment. The current bug template has no default label or assignee. Private security reporting must not be replaced by a public label. No additional label is required by this guide.

Give potential exposure/data loss first attention, then reproducible installation/setup/time-entry/first-output/saved-work blockers, then wording and nonblocking usability. PMO owns final priority and participant impact. This ordering creates no response-time promise.

Record the category, version, evidence, next responsible function, authorized next action, request/repair counts and current state. Any acknowledgment should state the known next action and remaining evidence; do not invent a recipient acknowledgment or ETA.

Keep an issue open until the applicable documentation clarification or reproducible product fix has a reviewed outcome. A suggested retry, draft reply, internal rehearsal, completed runtime or unverified PASS is insufficient. File delivery, test results, independent review, owner acceptance and real participant usefulness remain separate outcomes.

Signed-in access for the intended independent reporter and the actual receiving/backup arrangement remain to be verified. Maintainer access and repository settings alone do not establish either condition.
