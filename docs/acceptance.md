# Review candidate acceptance

This page concerns **0.1.0-alpha.3-local.4**, an unpublished review candidate with SQLite schema **5**. It includes the delivery-hours Time Tracker, real Product Studio file workflows and the Little Powerhouse identity. The public alpha.2 release and its earlier checks are separate evidence. This is engineering acceptance, not customer validation, a human usability pilot or a security certification.

## Current evidence boundaries

| Gate                        | Current status and required evidence                                                                                                                                                                                                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source and exact package    | Final candidate commit, installed tarball and SHA-256 still need to be attached to the review. A development build alone is insufficient.                                                                                                                                                                       |
| Automated behavior          | Domain, Time Tracker, workflow, artifact, adapter and HTTP tests exercise synthetic fixtures. Record the final full-suite/type/build/format results against the frozen commit; do not substitute an old test count.                                                                                             |
| Core OS/Node matrix         | CI is configured for macOS, Linux and Windows on Node 24.14.0/current 24.x and 26.0.0/current 26.x. The final candidate's 12-job result is pending. [Workflow configuration and runs](https://github.com/strobl/gitflash/actions/workflows/ci.yml). Configuration is not passing evidence.                      |
| Local workflow sandbox      | An earlier [macOS adapter/sandbox snapshot](evidence/workflow-sandbox.json) records its exact source hashes and scope. Final-candidate Linux sandbox proof remains pending; native Windows fixed workflow checking is explicitly unavailable. Core platform support and optional runtime support are separate.  |
| Installed first company     | The final installed package must create a fresh company, expose its roles and Time Tracker, produce a useful file result through the actual five-stage workflow, retain independent checks, and leave explicit owner review separate. Attach version, port, job/session IDs, artifact hashes and interventions. |
| Recovery and delivery hours | Verify migration, backup/restore, exact artifact bytes, retry history and Time Tracker entries/corrections against the final package. Runtime duration must never create booked hours.                                                                                                                          |
| Independent contributor     | A separate agent contributor must follow CONTRIBUTING from a fresh clone and fresh dependency installation, run its commands and verify company/Time Tracker persistence. This run is pending the frozen commit; it is not an external human pilot.                                                             |
| Human/pilot usefulness      | External human attempts and usefulness feedback remain open. Internal synthetic execution, QA and owner-review fixtures do not close them.                                                                                                                                                                      |
| Buzz and Slack              | Buzz configuration import has historical evidence; live Buzz task dispatch/output and Slack mention/reply round trips remain unverified. Neither blocks the supported local route.                                                                                                                              |

Status is deliberately pending where final evidence has not yet been attached. Before publication, replace pending entries with exact revision/package evidence or preserve the limitation in the release notes. Do not infer acceptance from a configured role, model prose, a transport connection or a green check for another revision.

## Candidate-4 platform follow-up

[Candidate-4 CI at `ebf75a0`](https://github.com/strobl/gitflash/actions/runs/33963153103) passed all 12 packaged-core combinations on macOS, Linux and Windows, including Node 26.8.1 after the bounded backup-completion fix. Its macOS optional sandbox fixture also passed. The original archive remains immutable: SHA-256 `d2b7bc6ba3e8fbc761d5a67e0b6ff144683cff979bb71f44809065d1635cfe01`, 628,541 bytes, 64 files.

[The Ubuntu 22.04 follow-up at `e3c56f8`](https://github.com/strobl/gitflash/actions/runs/33963586491) passed the actual Codex 0.138.0/Python 3.10 checker. It preserves existing host bytes and inode, creates no new host file, refuses opening an explicitly read-bound host file for writing (`EROFS`), and denies networking (`EPERM`). A process-visible sibling write goes to the private `tmpfs` root and is not a host-write escape. No adapter permission or host security setting changed to obtain this result.

Stock Ubuntu 24.04 with its default AppArmor namespace restriction remains unsupported for optional workflow execution. CI names its separate expected-refusal check explicitly: Python must not start, no provider stage may dispatch, and company/time data must remain unchanged. A passing refusal check is not a Python execution PASS. Current first-company instructions and displayed help adapt the frozen Ops guide's archive version to local.4; canonical roles, prompts, brief, rubric and oracle remain unchanged. Final package identity and review are recorded separately from the immutable baseline.

## Observed iteration-3 results

The installed iteration-3 archive was built from `5fa982445b7e698a14dd354c0a95c899bea85964`: 625,494 bytes, 64 files, SHA-256 `26595325f1913963e04ba51a5ebadd5adff75ce825d954560eceeb2ee0c55338`. On Node 24.19.0/macOS arm64, source checks passed 213 tests with two opt-in skips, type checking, production build and formatting. A separate fresh HTTPS clone and dependency installation reproduced the same archive and passed the documented contributor commands, company creation, corrected delivery-hours entry and restart persistence. Independent installed migration/recovery review also passed its 12 bounded check groups on Node 24.19.0; it contained no completed workflow artifacts. These are engineering fixtures, not human pilots.

[The frozen source CI](https://github.com/strobl/gitflash/actions/runs/33957128090) passed 10 of 14 jobs. All nine core jobs on Node 24.14.0, current 24.x and 26.0.0 passed, as did the macOS sandbox fixture. Current Node 26.8.1 hit the backup test timeout on all three operating systems. Ubuntu sandbox startup failed before Python; [the diagnostic run](https://github.com/strobl/gitflash/actions/runs/33957365694) captured `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted`. These failures remain open until an exact later revision supplies passing evidence or an explicit supported-platform limitation.

The iteration-3 five-seat runtime correctly stopped intake when the prompt prematurely requested the future QA session identity. The next candidate clarifies stage timing while retaining the actual-session independence gate at QA. The original stopped job remains preserved. Final workflow, restored artifact, CI and release acceptance are not inferred from these partial results.

## Reproduce the candidate

1. Use the exact candidate archive and isolated install command in [README](../README.md), or clone the supplied candidate branch/commit and follow [CONTRIBUTING](../CONTRIBUTING.md). Record GitFlash, Node, OS and source/package identity.
2. Start a new data directory and open the printed loopback URL. Apply **Product Studio (5 seats)** or **100-agent Product Studio** through the template preview. Check company, role and reporting identities; creating them starts no model work.
3. Open **Time Tracker**. Add a labelled synthetic human-equivalent delivery-hours entry, correct it, inspect its history and analytics, and check the calculation basis. Preserve the distinction between explicit/catalog/fallback hours and runtime duration.
4. With the optional local runtime prerequisites satisfied, open **Work → Company jobs → Set up first job → Start job**. Observe five distinct role sessions, actual file creation, fixed independent checking and QA against the same candidate. Record any failure, explicit retry or repair honestly.
5. Choose **Download reviewed files (.zip)**. Inspect the utility, tests, expected output, usage and provenance. A passed workflow waits for an explicit **Accept candidate** or **Reject candidate** decision with a review note; label any synthetic review as such.
6. Stop and restart the workspace. Follow [backup/restore](recovery.md) into a fresh directory and compare company identities, work/job records, downloadable artifact bytes and Time Tracker entries/history. Recovery must not trigger new provider execution.
7. Exercise individual tasks separately if included in the release claim. They retain the original read-only text-output route and a separate queue. Buzz/Slack operational claims require their own live, authorized round-trip evidence.

Keep raw evidence local when it contains private task text, paths or identities. A public summary should retain exact versions, hashes, observed outcomes and limits without credentials, customer content or full databases. Record every manual intervention; never turn an access hold or NOT RUN check into PASS.

## Historical alpha.2 evidence

The earlier [six-job Node 24 matrix](https://github.com/strobl/gitflash/actions/runs/33921511257) and [individual-task runtime records](evidence/README.md) belong to the earlier technical alpha. They establish only the revision and behaviors identified there. They do not test this candidate's Time Tracker integration, schema 5, company jobs, new branding or Node 26 matrix.

The historical Buzz 0.5.8 import created two stopped agents. It proves native configuration import, not effective runtime/model selection, task dispatch or returned work. Slack evidence remains fixture-based. Earlier performance observations are not minimum requirements, current-candidate measurements or model-latency benchmarks.

## Publication gate

Review the candidate PR, pass the final revision's required matrix, inspect and install its exact tarball, verify the actual browser/company/Time Tracker/workflow journey, complete the independent contributor run, and check license/private-data boundaries. Preserve unsupported routes and open human-pilot dependencies in [handoff](handoff.md).

Only after publication is authorized, publish an immutable technical prerelease with source revision, tarball and SHA-256. Download it through its public URL into a clean prefix and verify checksum, CLI, served assets and persistence. A candidate package, a draft PR or a local preview does not establish that the public release or site has changed.
