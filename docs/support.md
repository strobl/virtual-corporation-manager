# VCM support

Use this guide for corporation setup, organization, delivery-hours and optional Product Studio problems. Follow the [first-company instructions](first-company.md) for the local setup journey. **Preparation status, 5 September 2026:** the corporation-first successor remains unpublished; exact installed-package and browser acceptance is recorded separately in [acceptance](acceptance.md). Earlier package evidence is not a pass for this interface.

## Corporation and hours recovery

Open **Your corporations** to choose the intended company before editing its team or recording hours. **Set up a corporation** captures identity and structure, then **Review changes → Apply changes** opens its saved overview. If an initial review is stale, the entered definition is retained while its revision refreshes. If a save response is interrupted, use **Retry save** to confirm the same receipt; do not create a second import to compensate for an unknown outcome.

Use **Log time** from the company or agent context, or open **Time Tracker**. Empty companies need an assigned member; **Add agent** opens that setup. For unexpected hours, preserve the entry reference, date, company/member and visible basis, and inspect its correction/void history. Runtime duration and accepting a job do not create delivery hours. Keep the full ledger and backup private.

## Optional Product Studio workflow

Before starting a job, fill **Acceptance owner** with the person or responsible role who will review the result. No account or legal name is required. Expand **Review the brief, criteria and sample data** to read the exact source materials. The named owner and start authority are captured with the job; final acceptance remains a separate decision.

## Start and inspect the included job

Open **Work → Company jobs**, select Product Studio and choose **Set up first job**. Review the PS-001 summary, assigned roles, resource notice and permissions, then choose **Start job**. The builder creates the candidate files in the job's local workspace. Inspect the retained artifacts and QA record, then download the artifact bundle from the job.

The expected files are `stock_alert.py`, `test_stock_alert.py`, `expected.json` and `USAGE.md`. A completed runtime does not establish successful tests or owner acceptance. Review the exact candidate and its recorded evidence before making the separate owner decision.

## Resolve the immediate symptom

| Symptom                                                                      | Safe next step                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product Studio or Set up first job is missing                                | Run the version command from the included first-company guide and record the selected company/template. Compare them with the release's first-company instructions. Report the missing control or role mapping; preserve the current setup.                                    |
| Codex or Python is unavailable                                               | Follow the prerequisites in the included first-company guide: this workflow requires macOS/Linux, the local Codex sandbox, a saved Codex login and Python 3.8+. Native Windows workflow checks are not supported yet. Do not put login data in a company definition or report. |
| Job remains queued or running                                                | Inspect the retained job state and the running GitFlash terminal. Preserve the job reference and any redacted error. Do not repeatedly start the same job.                                                                                                                     |
| Candidate files or artifact download are missing, incomplete or inconsistent | Preserve the original attempt, job reference and reviewed candidate/version identifiers. Record the missing filenames or smallest redacted discrepancy. Treat this as a delivery blocker and report it.                                                                        |
| A supplied test fails                                                        | Preserve the exact candidate, failing input and result. Leave the affected criterion failed and follow the job's bounded next action. Do not accept the failed version.                                                                                                        |
| A report claims success or failure without evidence                          | Preserve the report as a claim. Functional checks remain NOT RUN until supported by candidate inspection or reliable exact-version results. Missing mandatory evidence can separately fail the completeness requirement.                                                       |
| Authoritative records contradict a PASS or owner-acceptance claim            | Stop affected work and preserve both records. Request manager/owner disposition before further production, repair or acceptance. Missing proof alone does not establish deliberate falsification.                                                                              |
| Recovery might replace saved work or expose private data                     | Stop risky repetition and preserve local evidence. Follow recovery instructions supplied with the exact release. Use private vulnerability reporting for suspected security exposure.                                                                                          |

An actual **Start job** action for PS-001 authorizes the workflow described in its brief, including at most two corrective candidates for ordinary verified defects. Narrower permissions still apply: one evidence request does not authorize a code repair or another request. The general repair ceiling grants no action by itself. External messages, purchases, deployment and owner acceptance require their own authority.

## Report a problem safely

Sign in and open [VCM Issues](https://github.com/strobl/virtual-corporation-manager/issues/new/choose), then choose **Bug report**. Include:

- The VCM package version (`gitflash --version`) and Node version, operating system/architecture, and relevant Codex/Python versions.
- The failing guide step, expected behavior and actual behavior.
- The smallest synthetic reproduction or redacted discrepancy, plus the job/run reference and candidate identifier if safe to share.
- Current work state, missing artifact names, and any recovery already attempted. State when a reproduction or check has not been run.

Keep full originals private. Remove personal identifiers, usernames/home paths, hostnames, customer content and credentials from excerpts. Do not attach workspace databases/backups, provider login files, `.env` files, full private outputs or private screenshots. Do not start an extra model run just to complete a report.

Use [GitHub private vulnerability reporting](https://github.com/strobl/virtual-corporation-manager/security/advisories/new) for suspected vulnerabilities. If issue-form access is unavailable, retain the draft for an already agreed facilitator contact; no new contact or successful posting access is implied here. No paid-support SLA or response deadline is promised. Internal handling follows the included [triage guide](triage.md).
