# Product Studio workflows

All workflows apply `operating-contract.md`, including retry and response limits. Its v1.2.1 severe evidence gate overrides ordinary defect/repair routing. Job accountable seat: PS-DM. A reviewed version and its handoff never change in place after acceptance.

## PS-W1 — Brief to reviewed delivery

Trigger: owner submits a proposed software job. Inputs: brief, synthetic or authorized data, scope, tool availability, acceptance owner and resource limit.

| Step | Responsible | Work and concrete result | Transfer condition / next owner |
|---|---|---|---|
| 1 | PS-DM | Validate essentials; assign PS-REQ/BUILD/QA/DOC and reserve review capacity; intake decision | Complete brief → PS-REQ; missing/contradictory → one owner decision request, affected work waiting_owner |
| 2 | PS-REQ | Produce requirement IDs, behavior examples and test matrix, including boundary/invalid cases | Each criterion testable and conflict-free → PS-BUILD; QA receives the same version |
| 3 | PS-BUILD | Produce bounded candidate + local checks + changed-file list | Candidate and reproducible checks exist → PS-QA; unavailable tool → blocked with recovery action |
| 4 | PS-QA | Independently run/inspect criterion checks; record exact version and PASS/FAIL/NOT RUN | All mandatory checks pass → PS-DOC; ordinary authorized defect → numbered repair to PS-BUILD (two repairs max); severe evidence contradiction → blocked, PS-DM and owner recovery decision, no affected repair |
| 5 | PS-DOC | Assemble usage, artifacts, QA, limits and acceptance request | Packet matches reviewed version → PS-DM; mismatch → PS-QA re-review |
| 6 | PS-DM | Present accept/revise/cancel options to human owner | Actual owner accepts exact version → accepted; revision → PS-W2; no reply follows checkpoint rules |

Done: original deliverables and all mandatory checks satisfied, actual owner acceptance recorded and exact evidence retained. For this rehearsal: local artifact can be QA-passed and awaiting owner; a fixture acceptance remains separately labeled synthetic. Abandon on owner cancellation. No deployment step is implied.

## PS-W2 — Change request

Trigger: owner requests a change to a candidate or accepted result. Inputs: base artifact/version, requested difference, reason, original criteria and remaining capacity.

| Step | Responsible | Result | Transfer / stopping condition |
|---|---|---|---|
| 1 | PS-DM | Linked change record PS-CR-n, affected base and request | Complete request → PS-REQ; missing base → waiting_owner |
| 2 | PS-REQ | Delta criteria, affected tests, scope/risk options | Clarification or change in deadline/cost/permission → owner via PS-DM; reversible implementation detail within brief may proceed |
| 3 | Human owner through PS-DM | Recorded approve/reduce/defer/reject decision when required | Approved delta → PS-BUILD; silence never changes scope |
| 4 | PS-BUILD | New version; change log; preserved base; regression evidence | Ready candidate → PS-QA |
| 5 | PS-QA | Check old unaffected criteria + changed criteria, including negative/boundary cases | Pass → PS-DOC; failure → max two repairs, then owner scope/reassign/cancel decision |
| 6 | PS-DOC then PS-DM | Versioned packet and acceptance request | Actual owner accepts new version → accepted; previous acceptance remains historically valid |

Done: delta and regression rubric pass, owner accepts revised version, previous version and decision retained. Abort if change is withdrawn; preserve prior accepted output. Example: changing strict `<` to `<=` creates a conflict with PS-A1, so clarify intended zero-quantity behavior before modifying code.

## PS-W3 — Defect or stalled delivery

Trigger: failed acceptance criterion, disputed evidence, unavailable dependency or missed handoff checkpoint. Inputs: job/version, symptom, observed evidence, affected scope and last valid checkpoint.

| Step | Responsible | Result | Transfer / stopping condition |
|---|---|---|---|
| 1 | PS-DM | Incident ID, severity, affected job; pause affected authority for severe failures | Reproducible symptom → PS-QA; missing evidence → bounded evidence request |
| 2 | PS-QA | Reproduction, expected/actual behavior, affected criteria and severity | Ordinary technical defect → PS-BUILD; severe evidence incident → PS-DM/owner recovery gate before any repair; unavailable evidence/access → PS-DM blocker |
| 3 | PS-BUILD | Diagnosis and minimal repair proposal, no silent behavior change | Within authorized brief → repair; changed scope/access/risk → owner via PS-DM |
| 4 | PS-QA | Regression review of repaired version and evidence | Pass → PS-DOC; two failed repairs → owner reassign/reduce/cancel |
| 5 | PS-DOC | Corrected packet and transparent incident note | PS-DM obtains acceptance of affected corrected version |
| 6 | PS-DM | Root cause, preventive criterion/prompt update, linked retest and owner decision | Close only when defect is fixed or owner explicitly dispositions residual limit |

Done: impact identified, affected output corrected and reviewed, disposition recorded, preventive rule tested. No fake closure for a missing dependency. Example: boolean stock accepted because Python bool is an int subtype; add an explicit boolean rejection plus regression case, then re-review PS-A3. For an unacknowledged handoff, manager reassigns with current-state handoff rather than asking both agents to wait.
