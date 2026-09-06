# Owner status report — <company / period>

- Record type: status report
- Evidence mode: <actual work | synthetic fixture (`synthetic_owner_decision` for simulated owner choices)>
- Reporting window / timezone: <start–end>
- Prepared by / observed at: <seat ID / timestamp>
- Overall delivery outlook: <on track | at risk | blocked | unknown>; evidence: <why>
- Goal and current approved priority order: <goal; item IDs in order>

| Measure | Value | Evidence basis / observation time |
|---|---|---|
| Configured reusable role types | <count or unknown> | <manifest selection; distinct role IDs> |
| Configured seats | <count or unknown> | <selected scenario and manifest version> |
| Actually active agents | <verified count or not measured> | <run evidence; distinct execution identities in window; occupied seats reported separately> |
| Accepted work this window | <count or unknown> | <unique item IDs and real owner acceptance references> |
| Fixture acceptances, separately | <count or not applicable> | <expressly simulated decisions; exclude above> |
| Runtime cost / duration | <verified measurement or not measured> | <measurement source; do not infer from seats> |

| Work item | Accountable seat | State | Latest version / evidence | Next action and actor | Next check-in |
|---|---|---|---|---|---|
| <ID> | <one seat> | <policy state> | <link> | <concrete action; actor> | <time> |

- Accepted since last report: <item, exact result, acceptance link; or evidenced none/unknown>.
- Decisions needed from owner: <decision request IDs, recommendation, decision-by time, affected work>.
- Blockers and errors: <cause, impact, unblock owner, next check; never only “waiting”>.
- Quality: <criteria passed/failed/unchecked, repair count 0–2, independent review links>.
- Changes since last report: <scope, priority, due date, decisions and displaced work>.
- Next checkpoint: <what will become reviewable, accountable seat and time>.
- Evidence limits: <missing runtime access, unchecked assumptions, incomplete source coverage>.

Do not mark an item `accepted` because a draft exists or QA passed. Preserve `waiting_owner` until the human owner decides. Separate synthetic scenario results from actual production results.
