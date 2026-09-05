# Work item — <job_id>

- job_id: <unique bounded work item ID>
- company_id: <company ID>
- evidence_mode: <actual work | synthetic fixture>
- brief_version: <approved baseline reference and version>
- state: <queued | ready | in_progress | in_review | waiting_owner | blocked | accepted | cancelled>
- accountable_seat_id: <exactly one delivery-manager seat throughout the job>
- human_owner: <decision and acceptance owner>
- priority: <owner-approved priority and rationale>
- resource_ceiling: <owner-approved limit; default company WIP 2 jobs, one production step/seat>
- due_or_review_time: <timestamp and timezone>
- inputs: <source/fixture references and relevant versions>
- output_location: <authorized path / permitted destination>
- allowed_actions_and_tools: <concrete scope; local synthetic examples only>
- deliverables: <exact required artifacts>
- dependencies: <item, necessary output, unblock owner and check-in>
- acceptance_rubric: <criterion IDs and evidence required>
- repair_attempt: <0 initial candidate | 1 first repair | 2 second repair>

| Step | Assigned producer seat / executing identity | Independent reviewer seat / executing identity | Bounded result and output format | Receiving seat and requested action | Exit criterion |
|---|---|---|---|---|---|
| <ID> | <one producer> | <different identity> | <specific artifact> | <recipient; next action> | <observable condition> |

| State transition time | Previous state | Next state | Actor | Reason / evidence / decision reference |
|---|---|---|---|---|
| <timestamp> | <state> | <state> | <actor> | <link> |

- artifact_version_and_paths: <current candidate and retained prior versions>
- criteria_results: <criterion ID, PASS/FAIL/NOT RUN, exact evidence>
- assumptions: <explicitly labelled, within approved reversible scope>
- blockers: <cause, affected work, resolver and recovery check-in>
- next_seat: <one actor for next action>
- requested_action: <bounded next step>
- next_owner_review: <time, pending decision requests, reminder status>
- handoff_receipt: <reference, pending/received/returned, actor, time>
- acceptance_record: <pending or actual owner decision on exact reviewed version; fixture decisions labelled synthetic_owner_decision>
- linked_change_or_incident: <IDs or not applicable>

Reassignment requires a current-state handoff and explicitly ends the prior producer's authority for that step. It does not reset the repair counter or transfer overall accountability. The state remains `waiting_owner` after QA passes until the owner accepts. Preserve accepted and cancelled records; new scope becomes linked work.
