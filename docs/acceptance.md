# Technical alpha acceptance

This is engineering evidence for a local technical alpha, not customer validation or a security certification. The release notes and attached checksums identify the exact published artifact. Post-publication download checks are attached to the release so an artifact never needs to contain its own checksum.

## Observed checks

| Area                   | Observed evidence                                                                                                                                                                                                                                                                                                                                                 | Boundary                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Automated behavior     | 53 tests cover domain invariants, migration rollback, corrupt-data restore, stale/replayed changes, reviewed undo, process boundaries, integration receipts and frontend selection/session recovery. TypeScript and production build pass.                                                                                                                        | Fixture tests are labelled; they do not establish live external delivery.                                                                 |
| Installed distribution | `npm run test:package` creates the tarball, installs it using npm offline, starts its CLI and serves every referenced asset. It creates company/agent data, applies the 100-role template, restarts and restores a backup.                                                                                                                                        | Network is needed to obtain the initial download. The package has zero npm runtime dependencies.                                          |
| Operating systems      | The six-job [acceptance workflow](https://github.com/strobl/gitflash/actions/workflows/ci.yml) exercises Linux, macOS and Windows on Node 24.14.0 and latest 24.x. The first complete green matrix is [this run](https://github.com/strobl/gitflash/actions/runs/33921511257).                                                                                    | The release is gated on its final source revision, not merely this earlier green run. Live provider execution was observed on macOS only. |
| Actual browser         | Manual company/agent creation, detailed preview and apply, restart persistence, 100-role navigation/search, assignments, company collaboration, import and undo were exercised in the production console.                                                                                                                                                         | Desktop observations are agent-operated; not a human usability pilot.                                                                     |
| Offline core           | An installed process ran with empty HOME, no provider environment and macOS sandbox denial of non-loopback outbound connections. External-IP access failed and loopback succeeded. Actual browser company creation, then API edit/import/export/restart succeeded. Browser scripts/styles were local and CSP restricts connections/resources to the local origin. | The user's global networking was not disabled. This is process isolation plus browser-origin/resource verification.                       |
| Real work              | A manual Product Analyst and a Release Auditor from the 100-role template executed through Codex CLI 0.138.0. Actual outputs, IDs, duration and SHA-256 are in [runtime evidence](evidence/README.md).                                                                                                                                                            | These are working documents, with integrator corrections documented. They are not independent test certificates or owner acceptance.      |
| Buzz                   | Installed Buzz 0.5.8 accepted a generated team and showed two new stopped agents.                                                                                                                                                                                                                                                                                 | Effective runtime/model and dispatch/result round trip remain unverified.                                                                 |
| Slack                  | Explicit setup/connect, sender/channel checks, duplicate-event handling and uncertain-delivery behavior have automated coverage.                                                                                                                                                                                                                                  | No live app/token/channel round trip is claimed.                                                                                          |

## Scale and timing

Local machine: Apple M1 Pro, macOS arm64, Node 24.19.0. One installed-package smoke run took 1,285 ms total; the standard 100-role template preview and atomic apply took 24 ms through the HTTP API. A richer Operations definition with 100 complete role prompts, company charter and operating contract took 144 ms for preview/apply. All 100 full instructions and IDs survived export and restart.

A separate read-only baseline on the published alpha.1 used macOS 15.6.1, the same M1 Pro (10 cores), 16 GiB RAM and Node 24.19.0. The live dataset contained three companies, 106 agents and nine completed work/run records. After five warm-ups per endpoint, 50 sequential HTTP/1.1 GETs measured request-to-complete-body time (JSON parsing excluded):

| Endpoint     |       Payload |   Median |      p95 |  Maximum |
| ------------ | ------------: | -------: | -------: | -------: |
| `/api/state` | 305,073 bytes | 3.178 ms | 4.113 ms | 4.588 ms |
| `/api/runs`  | 111,298 bytes | 4.723 ms | 8.122 ms | 8.460 ms |

All 100 responses were HTTP 200; state, run and database hashes remained unchanged. Server RSS was 42.55 MiB before, 106.17 MiB afterward and 128.22 MiB at the largest sample. The database and its existing backup each occupied 11.375 MiB; WAL was empty. These are observed warm-process resources, not minimum requirements, browser memory, a continuous peak, provider cost or model performance. p95 is the nearest-rank 48th of 50 observations.

The template-apply timings are single-run observations; the warm GET baseline is a finite sample on one machine. Neither measures model latency, concurrent workers or browser paint time. The initial executor deliberately has concurrency one and a queue limit of 20. Creating a company starts zero runtimes.

The browser tree can find a role at the end of the 100-role company without losing its department and inspector. Shared agents have unique DOM row IDs in each company and preserve the selected company context. Desktop and narrow layouts, focus visibility, form labels, modal focus/escape and recovery messaging were inspected. A full screen-reader or assistive-technology audit is not claimed.

## Reproduce the first session

1. Follow the release's exact install command, then run `gitflash --data-dir ./acceptance-company`. Open the printed URL if automatic browser launch is unavailable.
2. Create a company and an agent. Confirm the preview contains the entered values and that discarding a preview changes no configuration.
3. Apply the 100-role template. Search for **Release Auditor**, inspect its department, manager, instructions and responsibilities, and switch between map, reporting lines and agent list.
4. Edit a company. Use **Activity & undo** to review the reverse changes, cancel once, then confirm. Open two previews from the same revision and verify the second is refused after the first changes the workspace.
5. Stop and restart the same data directory. Compare company/agent identities. Follow [backup and restore](recovery.md) into a fresh directory and compare assignments, work and history.
6. With an optional supported Codex CLI login, give an agent a bounded task. Inspect actual output and provenance in **Work**. Do not infer success from a configured role or an empty result. Review before accepting work.

Record version, OS, Node version, commands, artifact checksum, run IDs, expected/actual outcomes and every manual intervention. Keep private task text and credentials out of public reports. A real human's usefulness assessment remains a separate handoff item.

## Release gate

Before publication: review the PR, pass the final revision's matrix, build and inspect the exact tarball, verify the installed browser journey, and check license/private-data boundaries. Publish an immutable technical prerelease with source revision, tarball and SHA-256. Download it through the public URL into a clean prefix and verify the checksum, CLI, assets and state round trip. Attach that result to the release.

No unresolved critical data-loss or exposure finding may be hidden behind an alpha label. Experimental transport support and missing human pilot feedback remain visible in [handoff](handoff.md).
