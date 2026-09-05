# Optional runtimes and integrations

Company creation, configuration, local storage, Time Tracker and browsing work without accounts or network access. Running an AI task or company job is a separate, explicit action. GitFlash is free; your selected runtime can consume an existing subscription allowance or paid API usage. GitFlash does not purchase credits, provision paid inference or start tasks in the background on launch.

## Codex CLI

Install the optional [Codex CLI](https://learn.chatgpt.com/docs/codex-cli) using its official instructions, then run `codex login` and `codex login status`. GitFlash detects `codex` on PATH; an operator can set `GITFLASH_CODEX_PATH` to an absolute executable path when needed. GitFlash uses the CLI's saved authentication and deliberately does not inherit unrelated connector credentials or user-configured MCP servers.

### Individual tasks: read-only text output

Select an active company agent, or open **Work → Individual tasks**, enter the actual task and choose Run. GitFlash allows at most 20 outstanding individual tasks and executes one at a time. The subprocess runs in a dedicated task directory with a read-only sandbox. It receives the selected role, current company context and the five latest nonfailed company outputs. It returns its text deliverable through the supported JSONL event stream. The app saves a result only after successful process and terminal task completion. A submitted work record still needs human acceptance.

GitFlash probes the installed executable for required flags, including `--ignore-user-config`. If the CLI is too old, upgrade it. GitFlash never adds approval-bypass arguments. The default task limit is five minutes; cancellation or shutdown terminates the subprocess. Interrupted tasks remain visible as failed and require a new explicit request; uncertain external effects are never silently repeated. [Official execution reference](https://learn.chatgpt.com/docs/non-interactive-mode).

The workspace SQLite database contains the task ledger, request IDs, input context, complete outputs and hashes. The normal workspace backup therefore includes runtime history and idempotency records. Copies under `runs/<id>/result.md` are convenience artifacts; the complete result remains retrievable from the restored ledger without them. Backups contain private task context and outputs. Keep them private like the workspace itself.

Workspace data, staged task context, outputs and backups are stored in plaintext; GitFlash does not encrypt them at rest. Local file permissions provide access control. The read-only runtime sandbox restricts tool-driven writes but is not an isolated operating-system user or virtual machine and does not guarantee that other local files are unreadable. Submit only information you intend to share with the selected model provider. GitFlash does not display or persist raw provider stderr; failure messages use bounded, redacted diagnostics.

### Company jobs: bounded file production

Create **Product Studio (5 seats)** or **100-agent Product Studio**, then open **Work → Company jobs → Set up first job → Start job**. The included PS-001 job passes a synthetic inventory brief through delivery management, requirements, build, independent QA and handoff. Each role has a distinct captured identity and observed runtime session. Creating the company does not execute the job.

This route uses Codex workspace-write permissions in fresh stage directories. Local commands can create and test files; shell networking, web, apps, plugins and delegation are disabled. There is no escalation/bypass fallback. The sandbox restricts writes but does not provide full OS-user read isolation. Provider authentication remains with the CLI; it is not copied into a company definition or downloaded artifact.

Python 3.8+ and the fixed local Codex sandbox must pass a prerequisite check before any model stage. `GITFLASH_PYTHON_PATH` may select an absolute Python executable. Native Windows supports the local core and Time Tracker, but this fixed checker is unavailable there. The accepted runtime parent has passing macOS and Ubuntu 22.04 sandbox fixtures with Codex 0.138.0. Stock Ubuntu 24.04 with its default namespace restriction is an unsupported optional-workflow configuration: the prerequisite check refuses execution before provider dispatch. The new local release revision has not yet run remote CI; exact revisions and the separate expected-refusal result are recorded in [acceptance evidence](acceptance.md). A successful Codex login alone does not establish workflow readiness on an operating system.

Actual runtime-created UTF-8 files are captured into SQLite with hashes. A fixed independent oracle checks the exact candidate; a different QA session inspects unchanged producer files and runs the prescribed test invocation. A completed handoff leaves the job waiting for an explicit owner decision. The service does not turn model code blocks into files or infer tests from an agent's claims. See [the complete workflow contract](product-studio.md).

One company job runs at a time, with at most three active/queued jobs. This queue is separate from individual tasks, so one additional individual task may run concurrently. A stage has a five-minute limit. Ordinary verified defects permit an initial candidate plus two repairs; contradicted PASS evidence or other severe findings stop ordinary repair. Failed runtime stages have at most two explicit retries, which preserve completed stages. Restart never silently resumes a provider call. These workflow bounds do not change the original individual-task route.

Backups include the job ledger, captured context, all saved artifact bytes, command/session evidence and owner decisions. Disposable stage folders are not required to recover the reviewed downloads. Runtime duration, independent QA, owner acceptance and Time Tracker's booked delivery hours remain separate facts.

## Buzz

Buzz is experimental for task execution in this candidate. The historical import result below proves configuration transfer only; task dispatch/output acceptance remains open.

Export a canonical `.team.json` from GitFlash. In Buzz Desktop, use Agents → Agent teams → Import, inspect its preview and confirm the team. This is a configuration transfer; importing creates new identities, and repeating an import can create duplicates. GitFlash does not start these agents or claim that they executed work. The generated snapshot includes role instructions, empty memory, Codex as optional runtime, one worker per identity and owner-only response policy. Verify native import compatibility with your installed Buzz release. Persona-pack files are a different format and are not a Desktop activation path.

A two-role snapshot generated by GitFlash was successfully imported in native Buzz 0.5.8; both roles remained stopped. Confirm the effective runtime and model before starting imported agents: the native cards can display inherited provider defaults. This test establishes configuration import, not task execution. Import can synchronize team/profile metadata to your configured relay.

For the optional CLI task path, an operator supplies these environment values to the local GitFlash process:

```text
GITFLASH_BUZZ_PATH=/absolute/path/to/buzz
GITFLASH_BUZZ_RELAY_URL=https://your-relay.example
GITFLASH_BUZZ_CHANNEL_ID=<channel UUID>
GITFLASH_BUZZ_AGENT_MAP={"<GitFlash agent ID>":"<Buzz agent public key>"}
BUZZ_PRIVATE_KEY=<sender identity secret supplied securely>
BUZZ_AUTH_TAG=<owner attestation when required by the relay>
```

Do not put credentials in company definitions, URLs, argv or team exports. Prefer the supported Buzz-managed credential environment; do not copy secrets from Desktop's private stores. The sender and target need channel membership, and the target agent's response policy must permit the sender. Start the selected agent through Buzz's supported controls with your own configured runtime access.

Selecting Buzz for an explicit task dispatches through the CLI, records the relay acknowledgment and waits for a signed response from the mapped identity in the task thread. Relay acceptance is not task completion. Network uncertainty after sending is shown as uncertain; inspect the channel for the task ID before retrying. GitFlash does not auto-resend. [Buzz source and releases](https://github.com/block/buzz), [canonical snapshot schema](https://github.com/block/buzz/blob/main/desktop/src-tauri/src/managed_agents/team_snapshot.rs).

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

Then explicitly connect Slack in the host integration API. Startup never connects automatically. The initial adapter admits only that workspace, channel and owner. Use `@GitFlash Agent name: your bounded task`. Ambiguous names return guidance without starting inference. The mention queues local Codex execution, and the result is posted to the originating thread with the contributing agent name. Keep the local GitFlash process running to receive tasks. Socket Mode needs no public HTTP endpoint, tunnel or exposed local server. [Slack Socket Mode](https://docs.slack.dev/tools/bolt-js/concepts/socket-mode/).

The release must distinguish automated fixture tests from live integration acceptance. A generated team, successful token check, connected socket or mocked response alone does not prove a working agent company. A live proof needs a real task, a useful reviewed deliverable and matching runtime/transport evidence.
