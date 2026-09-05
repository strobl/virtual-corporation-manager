# Product Studio

ID: `ao.company.product-studio`. Reference company. Content revision 1.1.

## Service and customer

A founder-led software studio delivers a small, bounded software change and the evidence required to review it. The buyer/recipient is an internal product owner or small business operator who provides a concrete problem, permitted workspace and acceptance examples. The offer is an agreed change, acceptance tests and an understandable handoff; production hosting and ongoing operations require separate orders.

Required inputs: business outcome, users, current behavior, desired behavior, editable scope, data examples, constraints, runtime/tool availability, permissions, deadline, resource ceiling and acceptance owner. Without a permitted workspace, deliver a specification while recording implementation as blocked; never call a plan implemented code.

Outputs: reviewed brief, requirement/test matrix, local candidate change, observed test evidence, known limitations, change log and owner acceptance request. `examples/product-studio/` contains the complete synthetic stock-alert job.

## Team

| Seat | Reusable role | Department | Owns | Handoff |
|---|---|---|---|---|
| PS-DM | ao.role.delivery-manager | Delivery | Job accountability, scope checks, priority, blockers | PS-REQ then owner |
| PS-REQ | ao.role.requirements-analyst | Product | Behavior and measurable criteria | PS-BUILD and PS-QA |
| PS-BUILD | ao.role.software-builder | Delivery | Bounded candidate and reproduction notes | PS-QA |
| PS-QA | ao.role.quality-reviewer | Assurance | Independent rubric assessment | PS-BUILD on fail; PS-DOC on pass |
| PS-DOC | ao.role.handoff-editor | Delivery | Exact-version delivery packet | PS-DM |

PS-REQ, PS-BUILD and PS-DOC report to PS-DM for coordination. PS-QA reports to PS-DM operationally but its failed verdict cannot be overridden by the manager; owner may approve revised scope with a documented limitation, followed by independent review against that revised rubric. Unauthorized actions or fabricated evidence require remediation. The human owner is not counted among five agents.

Recurring work: intake/plan/build/review/handoff, bounded changes, incident/corrective action. Review the queue and decisions at each owner checkpoint; examine rework and accepted outcomes weekly. Product success means an owner can review and use the agreed artifact, not that every configured seat was activated.

## Quality and decisions

Every mandatory criterion must pass, evidence must reference the submitted version, reviewer must be independent, and limits must be clear. Owner decides priority conflicts, changing behavior, extra spend/access, releasing externally, risk exceptions and final acceptance. No simulated decision establishes real authority.

The scenario reuses the present Product Studio concept and department purposes from `gitflash/src/company/templates.ts`; it narrows to five useful seats for the first job. See `research/source-audit.md` for provenance and `management/` for expansion. This content does not modify or validate the product's 20/100-agent templates.
