# Alpha.8 company-management delivery verification

Verified on 8 September 2026. This is an engineering acceptance record using fictional QA data, not customer adoption or external usefulness evidence.

## Delivered product

The primary loop is **create a company → add Humans and AI Agents → maintain responsibilities, reporting and membership → reopen the same company**. CompanyConsole is the normal workspace. Templates, model connections, tasks and Product Studio are optional. The complete local SQLite core remains MIT, with no mandatory account or provider.

The implementation was already delivered by [PR #8](https://github.com/strobl/virtual-corporation-manager/pull/8). [PR #9](https://github.com/strobl/virtual-corporation-manager/pull/9) retained it and changed visible distribution filenames. This verification found no product-code change necessary for the checked journeys. It adds current package acceptance rather than treating Alpha.7 evidence as proof of an Alpha.8 installation.

## Exact distribution

- Product source and release tag: `6ecdd7f22052724cc942ca0268419e4bb4ad015e`.
- Version: `0.1.0-alpha.8`.
- [Published prerelease](https://github.com/strobl/virtual-corporation-manager/releases/tag/v0.1.0-alpha.8).
- [Download vcm-0.1.0-alpha.8.tgz](https://github.com/strobl/virtual-corporation-manager/releases/download/v0.1.0-alpha.8/vcm-0.1.0-alpha.8.tgz).
- Archive: 1,281,442 bytes, 86 regular files.
- SHA-256: `95258d5b0e72d0a7f135378364b428652f2f966e46534f815432f3699e6f7aea`.

An anonymous download matched that checksum. A fresh checkout of the product source, `npm ci --ignore-scripts`, build and `npm run pack:release` reproduced the exact archive checksum. All 86 installed files matched the downloaded archive. This report is outside the package's declared files; adding it does not change the product archive or its provenance.

Use Node.js 24.14+ within 24.x, or 26.x. After downloading and verifying the archive:

```sh
npm install --offline --ignore-scripts --prefix ./vcm-preview ./vcm-0.1.0-alpha.8.tgz
npm exec --offline --prefix ./vcm-preview -- vcm --version
npm exec --offline --prefix ./vcm-preview -- vcm --data-dir ./my-company
```

The first command was exercised with an empty npm cache. Expected version is `0.1.0-alpha.8`. The installed package and compatibility command remain `gitflash`; `vcm` is the primary command. Existing data paths and wire identifiers are unchanged.

## Current acceptance

| Journey                 | Observed result                                                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh company           | Fresh install starts with no companies or members. Name-only review, Back retaining the name, Cancel without mutation, and one empty-company save passed. No template, runtime or task was required.                                                                                                                                                          |
| Persistence             | Reload and an actual server stop/restart preserved the complete API state, company/member IDs, responsibilities and reporting. The same company could be reopened.                                                                                                                                                                                            |
| Humans and AI Agents    | Created both kinds, recorded responsibilities, assigned the Agent's reporting line to the Human and edited the Agent through review. Human details exposed manual work/time actions and no execution control.                                                                                                                                                 |
| Reviewed changes        | Member review displayed the proposed change; Back retained the full responsibility draft. A simulated interrupted apply response showed confirmation pending. Reload made no automatic retry; explicit Retry sent the exact same request body and saved once.                                                                                                 |
| Shared membership       | Existing shared-member context and editing warning were checked. A new additional company assignment was reviewed, retained on Back and applied through the native interface without creating another member identity. Primary membership, reporting and company ownership remained separate.                                                                 |
| Desktop/mobile/keyboard | Actual Chrome test-browser sessions at 1280×900 and 390×844 exercised company/member management and long-name review without page overflow. Initial dialog focus, one Tab remaining inside the dialog and Escape returning focus to Edit company passed. The integrated browser independently reopened the installed company and exercised shared membership. |
| Time Tracker            | Member Log time retained the exact company/member in both filters and booking form; cancel booked nothing. Returning from the time-table member focused the member inspector at 390px. Company-total hours cleared the member filter.                                                                                                                         |
| Upgrade                 | A safe SQLite backup of an existing workspace was opened with the downloaded package. All 19 tables and 175 typed rows remained identical after upgrade and read-only UI navigation. Time entries, catalog, corrections/history and other persisted values were included in this comparison. No provider run or booked hours was created.                     |

Current source checks passed **350 tests with 3 optional sandbox tests skipped**, type checking, production build and packed installation/recovery acceptance on macOS arm64 with Node 26.0.0. The packed check covers command aliases, export, backup/restore, retained history and uninstall preserving external workspace data. Existing source tests cover stale/missing previews, atomicity, time correction/void/export and archived contexts. Earlier Alpha.7 native large-roster and concurrent-undo observations remain dated evidence; this record does not claim those full scenarios were repeated.

The relevant source was inspected: CompanyConsole, QuickCompanySetup, Dialogs, company-console-model, change-recovery, App navigation and TimeTracker. The Alpha.7→Alpha.8 UI diff changes download filenames in App, TimeTracker and Work; the management/review implementation is retained. Time exports keep the existing format identifiers.

## Documentation and limits

The installed README and documentation matched the built source and archive. README, first-company guide, developer quickstart and CLI help were checked against the actual commands and company flow. All 19 deployed public site files, including [the homepage](https://strobl.github.io/virtual-corporation-manager/) and [Docs](https://strobl.github.io/virtual-corporation-manager/docs/), matched current source bytes.

A separate normal connected Chrome profile still rejected the loopback URL with `ERR_BLOCKED_BY_CLIENT` on this date. The dedicated Chrome test browser and integrated browser loaded the same server successfully. No browser security setting was disabled. This is an environment-specific access limitation, not a blanket claim that every browser profile was accepted.

Live Buzz/Slack execution, Product Studio useful-output acceptance, external operator usefulness and retention remain separate open criteria. No simulated QA activity is counted as customer proof. This record does not publish local workspaces, private attachments or internal coordination records.
