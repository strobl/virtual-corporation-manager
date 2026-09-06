# Optional Product Studio support

For company setup, humans, agents and responsibilities, start with the current [first-company guide](../../first-company.md) and [company-management guidance](../company-management.md). Basic company management requires no workflow or runtime. This support guide covers the optional PS-001 example described in [Product Studio](../../product-studio.md). Use the exact candidate's [acceptance record](../../acceptance.md) for its observed execution and package status; this guide is not an execution result.

## Start and inspect the included job

Select the intended company and open **Tools → Agent runs & records → Workflow examples**. When the required five roles are present, choose **Set up example**. If the example company is not configured, choose **Preview Product Studio**, review it and explicitly save the company first. Existing scoped jobs also offer **Run example** to open setup. Opening setup or applying a template does not start a provider job. Review the PS-001 summary, assigned roles, resource notice and permissions, name the acceptance owner, then explicitly choose **Start job** when authorized. Inspect actual retained artifacts and QA evidence before downloading or accepting a produced bundle; the [workflow guide](../../product-studio.md) retains the current failed/rejected outcome boundaries.

The expected files are `stock_alert.py`, `test_stock_alert.py`, `expected.json` and `USAGE.md`. A completed runtime does not establish successful tests or owner acceptance. Review the exact candidate and its recorded evidence before making the separate owner decision.

## Resolve the immediate symptom

| Symptom | Safe next step |
|---|---|
| Product Studio or Set up example is missing | Record `vcm --version` and the selected company. Compare **Tools → Agent runs & records → Workflow examples** with the current [Product Studio guide](../../product-studio.md). Use Preview Product Studio when the example is not configured; preserve the setup and report any missing control or invalid role mapping. |
| Codex or Python is unavailable | Follow the exact platform and sandbox prerequisites in the [Product Studio guide](../../product-studio.md). Use **Tools → Connections** to inspect optional runtime readiness. This workflow needs a supported local Codex sandbox, saved Codex login and Python 3.8+; native Windows workflow checks are not supported yet. Do not put login data in a company definition or report. |
| Job remains queued or running | Inspect the retained job state and the running VCM terminal. Preserve the job reference and any redacted error. Do not repeatedly start the same job. |
| Candidate files or artifact download are missing, incomplete or inconsistent | Preserve the original attempt, job reference and reviewed candidate/version identifiers. Record the missing filenames or smallest redacted discrepancy. Treat this as a delivery blocker and report it. |
| A supplied test fails | Preserve the exact candidate, failing input and result. Leave the affected criterion failed and follow the job's bounded next action. Do not accept the failed version. |
| A report claims success or failure without evidence | Preserve the report as a claim. Functional checks remain NOT RUN until supported by candidate inspection or reliable exact-version results. Missing mandatory evidence can separately fail the completeness requirement. |
| Authoritative records contradict a PASS or owner-acceptance claim | Stop affected work and preserve both records. Request manager/owner disposition before further production, repair or acceptance. Missing proof alone does not establish deliberate falsification. |
| Recovery might replace saved work or expose private data | Stop risky repetition and preserve local evidence. Follow recovery instructions supplied with the exact release. Use private vulnerability reporting for suspected security exposure. |

An actual **Start job** action for PS-001 authorizes the workflow described in its brief, including at most two corrective candidates for ordinary verified defects. Narrower permissions still apply: one evidence request does not authorize a code repair or another request. The general repair ceiling grants no action by itself. External messages, purchases, deployment and owner acceptance require their own authority.

## Report a problem safely

Sign in and open [VCM Issues](https://github.com/strobl/virtual-corporation-manager/issues/new/choose), then choose **Bug report**. Include:

- VCM (`vcm --version`) and Node versions, operating system/architecture, and relevant Codex/Python versions.
- The failing guide step, expected behavior and actual behavior.
- The smallest synthetic reproduction or redacted discrepancy, plus the job/run reference and candidate identifier if safe to share.
- Current work state, missing artifact names, and any recovery already attempted. State when a reproduction or check has not been run.

Keep full originals private. Remove personal identifiers, usernames/home paths, hostnames, customer content and credentials from excerpts. Do not attach workspace databases/backups, provider login files, `.env` files, full private outputs or private screenshots. Do not start an extra model run just to complete a report.

Use [GitHub private vulnerability reporting](https://github.com/strobl/virtual-corporation-manager/security/advisories/new) for suspected vulnerabilities. If issue-form access is unavailable, retain the draft for an already agreed facilitator contact; no new contact or successful posting access is implied here. No paid-support SLA or response deadline is promised. Internal handling follows the included [triage guide](TRIAGE.md).
