# Optional runtimes and integrations

Company creation, human/AI membership, responsibilities, reporting, relationships, local storage and Time Tracker work without accounts or network access. Running an AI task or company workflow is a separate, explicit action. VCM's current local core is MIT licensed; your selected runtime can consume an existing subscription allowance or paid API usage. VCM does not purchase credits, provision paid inference or start tasks in the background on launch.

This guide describes **`0.1.0-alpha.8` corporation management**. The primary [company-management loop](product/corporation-management.md) requires no runtime connection or executed task. Open **Tools → Connections** for optional runtime setup. **Tools → Agent runs & records** holds individual output and manual contributions, with **Workflow examples** as a separate tab. Historical alpha.5/alpha.6, platform and live integration evidence retains its original identity in [acceptance](acceptance.md); the versioned release manifest records the current source and package checks.

## Codex CLI

Install the optional [Codex CLI](https://learn.chatgpt.com/docs/codex-cli) using its official instructions, then run `codex login` and `codex login status`. VCM detects `codex` on PATH; an operator can set `GITFLASH_CODEX_PATH` to an absolute executable path when needed. VCM uses the CLI's saved authentication and deliberately does not inherit unrelated connector credentials or user-configured MCP servers.

### Individual tasks: read-only text output

Open the intended company, select an active **AI agent** and use **Give a task** with a ready runtime. Enter the actual task, inspect the execution company and choose **Run task**. A shared agent executes in its primary company; viewing it through another assignment does not change that target. The UI identifies that company before starting, and the [runtime coordinator](../src/adapters/index.ts) rejects human members independently of the UI. VCM allows at most 20 outstanding individual tasks and executes one at a time. The subprocess runs in a dedicated task directory with a read-only sandbox. It receives the selected role, captured company context and the five latest nonfailed company outputs. It returns its text deliverable through the supported JSONL event stream. The app saves a result only after successful process and terminal task completion. A submitted work record still needs human acceptance under **Tools → Agent runs & records**.

A human member instead has **Record work → Review result → Apply changes** for an already completed contribution. That path saves manual submitted text with no runtime ID or duration. It needs no integration and books no hours. Creating either kind of member, assigning a manager or accepting a result does not dispatch work or create a time entry.

VCM probes the installed executable for required flags, including `--ignore-user-config`. If the CLI is too old, upgrade it. VCM never adds approval-bypass arguments. The default task limit is five minutes; cancellation or shutdown terminates the subprocess. Interrupted tasks remain visible as failed and require a new explicit request; uncertain external effects are never silently repeated. [Official execution reference](https://learn.chatgpt.com/docs/non-interactive-mode).

The workspace SQLite database contains the task ledger, request IDs, input context, complete outputs and hashes. The normal workspace backup therefore includes runtime history and idempotency records. Copies under `runs/<id>/result.md` are convenience artifacts; the complete result remains retrievable from the restored ledger without them. Backups contain private task context and outputs. Keep them private like the workspace itself.

Workspace data, staged task context, outputs and backups are stored in plaintext; VCM does not encrypt them at rest. Local file permissions provide access control. The read-only runtime sandbox restricts tool-driven writes but is not an isolated operating-system user or virtual machine and does not guarantee that other local files are unreadable. Submit only information you intend to share with the selected model provider. VCM does not display or persist raw provider stderr; failure messages use bounded, redacted diagnostics.

### Workflow examples: bounded file production

Select the intended company, then open **Tools → Agent runs & records → Workflow examples**. **Set up example** opens PS-001 when the company has its five required roles; **Preview Product Studio** offers reviewed example-company creation when roles are missing. **Product Studio (5 seats)** and **100-agent Product Studio** provide the fixed role mapping. Review the input, named acceptance owner and permissions before **Start job**. Existing scoped jobs also expose **Run example** to open the setup. These controls are optional utilities, not prerequisites for creating or managing the operator's company.

The PS-001 contract passes a synthetic inventory brief through delivery management, requirements, build, independent QA and handoff. Each operational role must match exactly one distinct active AI agent assigned to the chosen company; humans do not satisfy a workflow seat. Execution captures each role identity and observes each stage's runtime session separately. Creating the company does not execute the job, and reporting lines do not delegate its stages.

This route uses Codex workspace-write permissions in fresh stage directories. Local commands can create and test files; shell networking, web, apps, plugins and delegation are disabled. There is no escalation/bypass fallback. The sandbox restricts writes but does not provide full OS-user read isolation. Provider authentication remains with the CLI; it is not copied into a company definition or downloaded artifact.

Python 3.8+ and the fixed local Codex sandbox must pass a prerequisite check before any model stage. `GITFLASH_PYTHON_PATH` may select an absolute Python executable. Native Windows supports the local core and Time Tracker, but this fixed checker is unavailable there. The historical accepted runtime parent has passing macOS and Ubuntu 22.04 sandbox fixtures with Codex 0.138.0. Stock Ubuntu 24.04 with its default namespace restriction is an unsupported optional-workflow configuration: the prerequisite check refuses execution before provider dispatch. Consult [acceptance evidence](acceptance.md) for the exact source, CI and separate expected-refusal result; these historical fixtures are not a current-candidate pass. A successful Codex login alone does not establish workflow readiness on an operating system.

Actual runtime-created UTF-8 files are captured into SQLite with hashes. A fixed independent oracle checks the exact candidate; a different QA session inspects unchanged producer files and runs the prescribed test invocation. A completed handoff leaves the job waiting for an explicit owner decision. The service does not turn model code blocks into files or infer tests from an agent's claims. See [the complete workflow contract](product-studio.md).

One company job runs at a time, with at most three active/queued jobs. This queue is separate from individual tasks, so one additional individual task may run concurrently. A stage has a five-minute limit. Ordinary verified defects permit an initial candidate plus two repairs; contradicted PASS evidence or other severe findings stop ordinary repair. Failed runtime stages have at most two explicit retries, which preserve completed stages. Restart never silently resumes a provider call. These workflow bounds do not change the original individual-task route.

Backups include the job ledger, captured context, all saved artifact bytes, command/session evidence and owner decisions. Disposable stage folders are not required to recover the reviewed downloads. Runtime duration, independent QA, owner acceptance and Time Tracker's booked delivery hours remain separate facts.

**Actual useful-result acceptance remains open.** PS-001 v2 intake and its one retry each timed out after 300 seconds at `ultra`; no v2 bundle or owner acceptance exists. The earlier v1 ZIP remains rejected for its missing expected-reference file. Format-2 bundle support and successful recovery of those attempts do not establish a delivered result. This guide and the company-management update do not authorize another provider attempt or a reasoning change.

## Buzz

Buzz is experimental for task execution in this candidate. The historical import result below proves configuration transfer only; task dispatch/output acceptance remains open.

Export a canonical `.team.json` from VCM. In Buzz Desktop, use Agents → Agent teams → Import, inspect its preview and confirm the team. This is a configuration transfer; importing creates new identities, and repeating an import can create duplicates. VCM does not start these agents or claim that they executed work. The generated snapshot includes role instructions, empty memory, Codex as optional runtime, one worker per identity and owner-only response policy. Verify native import compatibility with your installed Buzz release. Persona-pack files are a different format and are not a Desktop activation path.

A two-role snapshot generated by the earlier product version was successfully imported in native Buzz 0.5.8; both roles remained stopped. Confirm the effective runtime and model before starting imported agents: the native cards can display inherited provider defaults. This test establishes configuration import, not task execution. Import can synchronize team/profile metadata to your configured relay.

For the optional CLI task path, an operator supplies these environment values to the local VCM process:

```text
GITFLASH_BUZZ_PATH=/absolute/path/to/buzz
GITFLASH_BUZZ_RELAY_URL=https://your-relay.example
GITFLASH_BUZZ_CHANNEL_ID=<channel UUID>
GITFLASH_BUZZ_AGENT_MAP={"<VCM agent ID>":"<Buzz agent public key>"}
BUZZ_PRIVATE_KEY=<sender identity secret supplied securely>
BUZZ_AUTH_TAG=<owner attestation when required by the relay>
```

Do not put credentials in company definitions, URLs, argv or team exports. Prefer the supported Buzz-managed credential environment; do not copy secrets from Desktop's private stores. The sender and target need channel membership, and the target agent's response policy must permit the sender. Start the selected agent through Buzz's supported controls with your own configured runtime access.

Selecting Buzz for an explicit task dispatches through the CLI, records the relay acknowledgment and waits for a response with the mapped public identity and exact task reference in the dispatch thread. VCM relies on the Buzz CLI and relay for event authenticity; it does not independently verify event signatures. Relay acceptance is not task completion. Network uncertainty after sending is shown as uncertain; inspect the channel for the task ID before retrying. VCM does not auto-resend. [Buzz source and releases](https://github.com/block/buzz), [canonical snapshot schema](https://github.com/block/buzz/blob/main/desktop/src-tauri/src/managed_agents/team_snapshot.rs).

## Slack

Slack is experimental in this candidate. Fixture coverage does not establish a live authorized mention → runtime → reply round trip; no such live proof is claimed here.

Create and install a Slack app with bot scopes `app_mentions:read` and `chat:write`, the `app_mention` bot event, and Socket Mode enabled. Generate an app-level token with `connections:write`; invite the bot to the chosen test channel. Configure these environment variables securely:

```text
SLACK_APP_TOKEN=<xapp token>
SLACK_BOT_TOKEN=<xoxb token>
GITFLASH_SLACK_CHANNEL_ID=<channel ID>
GITFLASH_SLACK_OWNER_ID=<authorized human user ID>
GITFLASH_SLACK_TEAM_ID=<optional expected workspace ID>
```

Then explicitly connect Slack in the host integration API. Startup never connects automatically. The initial adapter admits only that workspace, channel and owner. Select your installed app's actual mention, followed by `Agent name: your bounded task`; the display name of the app can differ. Ambiguous names return guidance without starting inference. The mention queues local Codex execution, and the result is posted as bounded literal text to the originating thread with the contributing agent name; the complete output remains in VCM. Keep the local VCM process running to receive tasks. Socket Mode needs no public HTTP endpoint, tunnel or exposed local server. [Slack Socket Mode](https://docs.slack.dev/tools/bolt-js/concepts/socket-mode/).

The release must distinguish automated fixture tests from live integration acceptance. A generated team, successful token check, connected socket or mocked response alone does not prove successful integration execution. A live integration proof needs a real task, a useful reviewed deliverable and matching runtime/transport evidence. Management usefulness is assessed separately against an operator's actual company-management needs; a Human-only company can be useful without optional execution. Neither proof closes missing evidence for the other.
