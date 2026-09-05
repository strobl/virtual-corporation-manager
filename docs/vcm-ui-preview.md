# VCM task workspace — review candidate

VCM — Virtual Corporation Manager is the public product identity. This isolated UI successor starts from accepted source `53d97457ea2b7ec78f730c8c9466036d9f07870c`. It is a local review candidate, not a published release or a live website at the selected domain.

## Four real entry actions

| Home action          | Existing destination                                                                                                           | Empty workspace                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Run a task           | Product Studio job preparation, with the selected company, installed brief, required roles and explicit execution confirmation | Choose a 5-seat or 100-seat Product Studio template, review it, explicitly save it, then continue to that new company's task brief. Cancelling or discarding clears the action intent. |
| Review results       | Work: company jobs or individual tasks, preferring results that need review in the selected company                            | Shows the existing first-company-task setup and its required structure. No result is invented.                                                                                         |
| Track delivery hours | Existing Time Tracker, retaining company and member context                                                                    | Explains that an active company and assignment are needed. No hours are created.                                                                                                       |
| Set up a company     | Existing company editor and preview/apply flow                                                                                 | The same real company form. Templates are also available from Home and Organization.                                                                                                   |

These destinations use the existing local application's navigation state. There are no new `/tasks` or `/results` server routes. `?selected=` continues to identify the selected company, department or agent.

Opening an action does not dispatch a job, accept a result or book hours. Company/template changes still require their existing review and explicit confirmation. The separate **Start job** submission retains its existing runtime requirements and execution permission. The available company job is the installed synthetic stock-alert exercise using `input.json`; it is not a catalog of arbitrary online tools.

## Preserved contracts

- The npm package, `gitflash` CLI, `~/.gitflash` directory, repository, SQLite schema and API identifiers keep their technical names. Browser identity is separate in `src/web/identity.ts`.
- Time Tracker still uses 124 reference definitions, explicit delivery hours, correction/void history, catalog versions and analytics. Runtime duration and owner acceptance do not create hours.
- Company, organization, individual tasks, integrations, backup/restore and historical records remain accessible. Stored names, owners, receipts and artifact bytes are never rewritten for branding.
- Canonical Agent Operations source content and its import receipt retain their accepted identities. The separately maintained active VCM Operations overlay has not replaced those sources.

## Review and publication boundary

Engineering provides a separate populated review workspace and an initially empty setup workspace, desktop/mobile captures, exact package/runtime comparisons and before/after data checks. The original accepted package and PMO workspace remain intact. Tests of this UI do not constitute a new provider run or a human usefulness pilot.

Public merge, release, repository About/Homepage, Pages and domain activation remain separate PMO/Founder actions. Before publication, verify the selected VCM domain, actual downloadable package and intended deployment target. Keep the existing GitFlash FDE site, its domains and historical releases unchanged. Never direct an install action to an older release while claiming this UI is included.
