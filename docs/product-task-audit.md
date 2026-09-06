# Historical corporation management and task capability audit

**Historical inspection snapshot — 6 September 2026, before the later CompanyConsole adoption.** The body below preserves the findings and proposed intervention from that inspection. Its component table, old navigation paths and words such as “new” or “revised” refer to that stage; they are not the current source map or acceptance evidence for a later package.

For current contributor guidance, use [Architecture for contributors](developer-architecture.md) and [the corporation-management product model](product/corporation-management.md). The current `App` opens companies in `CompanyConsole` and creates an empty company through `QuickCompanySetup`. Humans and AI Agents are first-class members. Corporations and Time Tracker are primary navigation; execution, connections and detailed organization views sit under Tools. These later changes do not turn the historical inspection below into proof of runtime execution or current UI acceptance.

Source inspection: 6 September 2026. This describes implementation, not proof of a live provider run. No agent was executed for this audit.

## Product center

The primary job is to manage virtual corporations: understand which companies exist, how they relate, who belongs to each company, who reports to whom, and what each teammate owns. Agents and humans belong in this company model. Executing or recording work is a subordinate member action.

The main improvement is to make this structure easy to create, inspect and change. A generic project or task board should not replace the corporation workspace.

## Existing architecture worth preserving

| Concept             | Model and behavior                                                                                                                             | Existing UI                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Corporation         | `Company` has a stable identity, purpose and active/archive state.                                                                             | `CorporationWorkspace`, `CorporationSetup`, company editor.                        |
| Company ownership   | A directed `Relationship` joins two companies. Ownership has a percentage; collaboration is a separate relationship kind.                      | `CompanyMap`; `Relationships` in `AdvancedDialogs.tsx`.                            |
| Department          | Belongs to one company and can have a department lead.                                                                                         | Organization tree/chart; department editor.                                        |
| Teammate            | `Agent` is the shared identity for AI agents and humans, distinguished by `kind`. Role, instructions and responsibilities describe the member. | Member editor, org chart and inspector. The revised editor exposes human creation. |
| Reporting hierarchy | `Agent.managerId` identifies one manager; it is global across that member's company assignments.                                               | Org chart, searchable manager field, `AgentPlacement`.                             |
| Company membership  | Dated `Assignment` rows connect a member to companies, with one primary company and additional memberships.                                    | `Assignments` in `AdvancedDialogs.tsx`; `AgentPlacement`.                          |
| Work and time       | Completed work, execution receipts and booked delivery hours are separate records.                                                             | `WorkView`, specialized `JobsView`, `TimeTracker`.                                 |

Sources: `src/domain/contracts.ts`; `src/domain/model.ts` (`agent.create`, `assignment.*`, `relationship.*`); `src/domain/graph.ts`; `src/web/CorporationWorkspace.tsx`; `src/web/CompanyMap.tsx`; `src/web/AgentPlacement.tsx`; `src/web/AdvancedDialogs.tsx`.

Membership must not be mistaken for company ownership, and a reporting line must not be mistaken for either. The model validates references, manager/ownership cycles and ownership percentages. Shared members retain one identity rather than being copied into each company.

## Three simplifications

1. **Keep the corporation visible.** Put company identity, ownership relationships, team membership and reporting structure together in a coherent navigation path. Preserve useful existing chart, relationship and placement components. Make the next structural action apparent without making the user understand database terminology.
2. **Make member setup small.** Name, role and AI agent/human type are the initial decisions. Keep working context, responsibilities, department and manager available as optional details. Existing identity and kind stay stable during editing. The member's kind determines whether execution or completed human result capture is appropriate.
3. **Make work a clear member capability.** General execution, the specialized example workflow and completed human work have different capabilities. Explain each where the action is available. Show the useful result and review state first; put runtime receipts, hashes and stage diagnostics in details. Preserve separate work acceptance and time accounting.

## Task critical path and limitations

The original general execution route was organization → selected member → inspector → Run a task → runtime dialog → Individual tasks. The Tasks area originally defaulted to Company jobs, whose installed workflow is `PS-001`, a fixed synthetic stock-alert exercise. Its start form accepts a human acceptance owner, not a custom task brief.

- `src/web/App.tsx`: `workMode`, `RunDialog` integration and original member inspector entry.
- `src/web/Work.tsx`: `RunDialog`, `submitRunTask` and `WorkView`.
- `src/jobs/content.ts`: `workflowInfo` fixes the exercise's title, brief and artifacts.
- `src/jobs/service.ts`: `start` requires exactly five distinct active AI identities with exact workflow roles. An additional matching role prevents starting.

General Codex tasks are implemented, but produce a read-only text deliverable. `src/adapters/codex.ts` supplies the company, colleague descriptions and five recent work records as context. Its prompt disallows contacting people, connectors and file changes; execution uses the read-only sandbox. Colleague context is not autonomous delegation. `src/adapters/index.ts` processes the general queue sequentially and persists `result.md` plus the execution receipt.

PS-001 implements a specialized sequence of independent role sessions, file artifacts, checks, bounded repairs and owner acceptance. This does not provide general autonomous company orchestration. `src/jobs/contracts.ts` and `src/jobs/service.ts` preserve those specialized execution and review states.

Humans already existed in the domain and could be supplied through imports or commands, but the ordinary member editor previously hardcoded `kind: 'agent'`. Human completed work can be represented by `work.record` with `provenance: 'manual'`, `status: 'submitted'`, `durationMs: null` and `runId: null`. The new `HumanResultDialog` exposes that existing completed-work capability. It does not assign future work, notify a human, launch a runtime or create an execution receipt.

## Invariants for the UI intervention

- Keep dated company membership and historical work provenance. A result belongs to its original company even if the member later moves.
- General execution currently uses the member's primary/first company. The selected company must not be displayed as the execution target unless the runtime agrees.
- Keep role instructions, responsibilities, department and manager values when advanced fields are collapsed.
- Preserve preview/apply recovery and revision checks underneath simpler editing.
- Configuration changes do not start agents. Runtime readiness does not prove completed useful work.
- Keep manual human work, provider output, accepted results and booked hours distinct.

Relevant verification: `tests/frontend-model.test.ts`, `tests/work-view-model.test.ts`, `tests/domain-store.test.ts`, `tests/change-recovery.test.ts`, `tests/adapters.test.ts`, `tests/jobs.test.ts`.
