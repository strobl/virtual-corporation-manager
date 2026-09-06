# Owner decision request — <decision ID>

- Record type: decision request
- Evidence mode: <actual work | synthetic fixture (`synthetic_owner_decision` for simulated owner choices)>
- Work item / company: <IDs>
- Requested by / accountable seat: <one seat ID>
- Current state: waiting_owner
- Decision owner: <human owner>
- Decision required by / timezone: <time; basis for urgency>
- Decision to make: <one concrete choice>
- Facts / sources: <evidence and exact artifact versions>
- Uncertainty or conflict: <what is missing or contradictory>
- Work paused / independent work that can continue: <IDs and rationale>

| Option | Result / scope | Benefit | Tradeoff or risk | Displaced work / timing impact |
|---|---|---|---|---|
| A — <recommended> | <specific action> | <why> | <consequence> | <qualitative unless measured> |
| B — <alternative> | <specific action> | <why> | <consequence> | <qualitative unless measured> |

Recommendation: <A/B and evidence-based reason>. If no decision arrives: <keep affected work waiting; checkpoint/escalation; silence is not approval>.

Owner decision: <pending | selected option | returned for information | cancelled>.
- Actual decision text / decision actor / timestamp: <only record received decision>
- Decision evidence link: <message or approved record; fixture labelled explicitly>
- Scope/criteria affected and new baseline reference: <exact delta>
- Resulting state / next actor / next action: <state, seat, bounded action>

A simulated fixture decision may exercise the workflow but cannot authorize real work or count as actual accepted work.
