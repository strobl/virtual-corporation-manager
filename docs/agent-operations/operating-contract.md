# Operating contract — version 1.2.2

This is an English content package for GitFlash, not a runtime specification. Every company uses these rules. Public company names describe the example service, not GitFlash's market positioning.

## Owner and work

The human owner sets the outcome, scope, priority, deadline, acceptable risk and resource ceiling. Each job has one accountable delivery-manager seat throughout its lifecycle. A specialist owns each assigned step. The manager may delegate one bounded step; specialists do not redelegate or create unbounded subteams. Delegation never transfers job accountability.

Before starting, record job ID, company ID, brief version, input references, exact deliverables, rubric, named producer/reviewer/owner, explicit permissions, output location and review deadline. Missing essentials or contradictory requirements produce one consolidated decision request. Work independent of that decision may continue with its own bounded scope. An assumption cannot silently replace a required decision.

A handoff contains job ID, artifact version/path, inputs used, criteria/check evidence, known gaps, next responsible seat and requested action. The receiver acknowledges or rejects with a specific gap during the next scheduled review. The sender remains responsible for delivery until receipt. The delivery manager resolves an unacknowledged handoff; there is no mutual waiting.

## States and exit rules

| State | Entry / responsible actor | Exit |
|---|---|---|
| queued | Manager records request without promising capacity | Manager names producer, reviewer and capacity → ready |
| ready | Required inputs and authority complete | Assigned producer starts → in_progress |
| in_progress | Producer performs bounded work | Artifact + evidence → in_review; dependency failure → blocked; owner decision → waiting_owner |
| in_review | Independent reviewer checks exact version against rubric | Pass → waiting_owner for acceptance; ordinary defect → in_progress with repair ticket; severe evidence incident → blocked and delivery manager |
| waiting_owner | Manager submits specific choices and consequences | Explicit decision → ready/in_progress/accepted/cancelled as applicable |
| blocked | Required tool/input/response unavailable; blocker owner and recovery action recorded | Dependency restored and scope revalidated → ready; severe evidence incident requires the recovery gate below; owner cancels → cancelled |
| accepted | Owner accepts a specific reviewed version and retained evidence | New request creates linked work; never edits accepted history |
| cancelled | Owner cancels, or existing brief explicitly authorizes cancellation condition | Preserve reason and partial artifacts; reopen only as linked work |

Approval of a brief is distinct from acceptance of the result. External release, spend and messaging require the owner's explicit permission for the concrete action; permission persists within that scope. The example packages allow local work only. An agent never writes a fictional owner decision as an actual decision. A fixture decision must be labeled `synthetic_owner_decision`.

## Bounded recovery

Under evidence-request-only permission, request the existing named candidate, logs and an explanation of the reported behavior only. Explicitly state that no code change or repair is requested or authorized. Never ask the producer to address, fix or correct the behavior, even conditionally. An evidence request is not a repair ticket and does not authorize a new or modified candidate.

A general maximum is a ceiling, not authorization. Apply the narrowest explicit limit for the same action and preserve different action types: permission for one evidence request does not authorize a code repair, another request, reminders or external actions. If the task allows one evidence request, issue at most one consolidated request and label it 1 of 1. Count executed repair candidates separately; issuing a request does not increment repair_attempt. If the request allowance is exhausted and required evidence is still absent, preserve work and return blocked to the accountable manager. Any new authority must be explicitly recorded by the responsible decision-maker within their authority; silence and the generic two-repair ceiling supply none.

Fixed repair maximum: two total repair attempts per work item after the initial candidate, never reset by a changed failure ID, reviewer or session. The owner may tighten this limit. Configurable cadence default: one scheduled owner review per business day; one reminder after a missed review, then the manager records `blocked` at the next missed review. Record actual checkpoint timestamps and timezone, or clearly synthetic checkpoint IDs. These are review checkpoints, not permission to poll or pretend an agent runs continuously. Lack of a response is never consent. No automatic external release. After two failed repairs, stop the affected work and ask the owner to reduce scope, approve a revised scope that explicitly describes the limitation, reassign, or cancel. A changed rubric must receive independent review before acceptance; an owner exception never turns an unrun or failed check into a pass. An unsupported test claim requires evidence and cannot pass QA; lack of evidence alone is not proof of deliberate fabrication. A severe issue (unauthorized action, data exposure or invalid acceptance evidence) stops the affected work immediately; preserve evidence and raise an incident.

Manager owns priorities and WIP (initial limit: two jobs/company, one production step/seat); owner resolves competing deadlines and scope/cost changes. Reassignment requires a written current-state handoff and cancels the old seat's authority for that step. Reviewer capacity is reserved before production starts. Each review names the producer and reviewer: the same executing identity cannot approve its own artifact, even if wearing another role.

## Evidence vocabulary

Assigned role or seat IDs are organizational labels, not evidence of executing identity. Different seat names such as PS-QA and PS-BUILD never establish review independence. Check the actual recorded producer and reviewer execution IDs for the exact candidate. If either execution ID is absent or unverified, record independence as NOT VERIFIED and its check as NOT RUN, never PASS; name the missing identity evidence. Do not invent execution IDs or infer that the identities match merely because evidence is absent. An authorized evidence request or a criterion verdict based on supplied authoritative results does not resolve this separate independence gap.

Grade each original acceptance criterion from evidence that establishes that exact behavior for the named candidate. A reported defect without an executable candidate, inspection evidence or authoritative exact-version result remains a reported finding; the functional criterion is NOT RUN. Do not turn the report into an observed FAIL. A missing required evidence packet may separately FAIL its completeness requirement, naming the missing items. Supplied authoritative results can support a verdict, but must be labeled as supplied evidence, not tests executed by this reviewer. Retain original criterion IDs; supplemental QA checks do not replace them. An unverified independence condition is a missing verification item, not proof that producer and reviewer are the same identity.

Record four independent fields; higher levels never imply the others:

- **Content complete**: required company, roles, flow, artifacts and rubric exist.
- **Example checked**: a named fixture was assessed against a named rubric with findings.
- **Agent rehearsed**: named agent task, input/output, environment and observed checks are retained. State the exact steps exercised.
- **GitFlash verified**: the package was configured and run via GitFlash, with target-side run and acceptance evidence. This package does not claim this level.

Configured seats are organizational records. Active agents have observed execution in a named interval. Accepted work is a separately reviewed artifact with actual owner acceptance. They are different denominators. Synthetic work, internal test results, customer outcomes and agent configurations remain distinguishable. Unknown time, costs and customer demand are `not measured`, not zero.

## Evidence gate precedence — v1.2.1

Apply this gate **before** ordinary QA repair routing or repair-attempt counting. It overrides every generic FAIL → producer rule.

| Observation for the exact submitted version | Classification | Required action |
|---|---|---|
| A test claim lacks logs, a candidate has an ordinary functional defect, or acceptance cannot be verified because no authoritative ledger was supplied | Unsupported evidence / ordinary defect | Never pass or accept. Within explicit action-specific permission, route one consolidated evidence request or bounded repair to the named producer with the manager informed; in_progress describes only that authorized next action. If permission is absent or exhausted, return blocked to the accountable manager without a producer request. A reported functional defect remains NOT RUN without establishing evidence; missing required proof may separately FAIL completeness. Do not infer fabrication or intent. |
| A passing claim contradicts a supplied authoritative failing transcript for the same version, or a claimed owner acceptance contradicts the authoritative decision ledger (including an explicitly empty ledger) | Severe evidence incident: observed invalid evidence | Immediately stop affected production, repair, acceptance and handoff. Preserve the version, statement, contradictory evidence and actual ledger state. Return blocked, next_seat = accountable delivery manager; issue one consolidated incident/owner decision request. Do not send the work directly back to the producer. |

A concrete contradictory record establishes invalid evidence; it does not establish the author's intent. Merely missing proof is not the same observation. A proposed repair plan is allowed as a conditional option, but it is **not repair authority** and must not produce in_progress or next_seat=producer while the incident is unresolved.

The manager owns the stopped item, records the affected versions and asks the human owner to authorize a bounded recovery scope, reassign, or cancel. Owner silence leaves blocked. Diagnostics and evidence preservation within existing permission may continue; no affected production/repair is restarted. After an actual recorded recovery decision, the manager names an independent reviewer, invalidates the disputed acceptance claim without erasing it, and opens linked recovery work in ready. Fresh valid evidence and independent review are required before requesting acceptance of the corrected version. No decision or past failed check is retroactively converted to PASS.
