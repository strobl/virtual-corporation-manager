# A mention. A mission.

Give a named AI role a focused task from Slack. VCM's optional adapter receives an allowed mention, runs the task through local Codex, and returns a bounded text result to the originating thread. The complete output remains in the local VCM workspace for review.

**Status:** experimental. The implementation has automated fixtures; live authorized mention → runtime → useful result → threaded reply acceptance remains open.

## Create your app

1. Open [Slack app management](https://api.slack.com/apps). Choose **Create New App → From a manifest**, select your workspace, and use [slack-app-manifest.json](slack-app-manifest.json).
2. Review the requested bot scopes: `app_mentions:read` and `chat:write`. The manifest subscribes to `app_mention` and enables Socket Mode. Install the app in your selected workspace.
3. Under **Basic Information → App-Level Tokens**, create a token with `connections:write`. Use the installed bot token from **OAuth & Permissions** for `SLACK_BOT_TOKEN`.
4. Optionally upload the [512 × 512 VCM app icon](https://github.com/strobl/virtual-corporation-manager/blob/main/brand/integrations/exports/06-slack-app-icon.png). The manifest names the app **VCM** and supplies its brand color; it does not install the image.
5. Invite your app to a channel you control. Record that channel ID, your authorized human member ID and, optionally, the expected workspace ID.

The manifest creates the configuration for your own app. It is not a public marketplace installation or an OAuth onboarding service.

## Connect VCM

Supply these environment values securely to the VCM process:

```text
SLACK_APP_TOKEN=<your xapp token>
SLACK_BOT_TOKEN=<your xoxb bot token>
GITFLASH_SLACK_CHANNEL_ID=<allowed channel ID>
GITFLASH_SLACK_OWNER_ID=<allowed human member ID>
GITFLASH_SLACK_TEAM_ID=<optional expected workspace ID>
```

These established `GITFLASH_*` configuration names remain compatibility identifiers. Keep tokens out of company exports, screenshots, terminal command history and repository files. VCM reads the process environment; it does not automatically load a `.env` file.

Start VCM with those values and your own configured Codex CLI access. Open **Tools → Connections**, check the runtime, and choose **Connect Slack**. Startup does not connect automatically. Keep the local process running. Socket Mode uses an outbound connection, so no public VCM URL or tunnel is needed.

## Address a role

In the allowed channel, use Slack's mention picker to select your installed app, then write a unique active AI-agent name, role or ID followed by a colon and the task:

```text
@VCM Reviewer: Find three missing details in this launch brief: [paste your brief]
```

`@VCM` must be a real mention of your installed bot; replace `Reviewer` with an active role in your workspace. Names are matched across active AI agents, so use a unique agent ID if the same name or role appears more than once. Ambiguous names receive guidance without starting inference. Humans are not executable agents.

Only the configured owner/channel and verified bot workspace are admitted. A qualifying mention queues a local Codex task. The adapter acknowledges events, deduplicates task requests and posts literal text in the originating thread. This route delivers text; it does not upload campaign images or generated files to Slack.

Review the full task output in **Tools → Agent runs & records**. A returned answer still needs human review; it does not automatically book delivery hours. Use **Disconnect Slack** when finished.

## First useful check

Use a channel and owner you control. Ask for a small text result, then verify the named role, task ID, saved local output and corresponding threaded reply. A connected status alone is not successful execution. If there is no result, inspect the local task record and runtime setup before sending another request.

## Sources and assets

- [Slack Socket Mode](https://docs.slack.dev/tools/bolt-js/concepts/socket-mode/) and [Slack app manifest reference](https://docs.slack.dev/reference/app-manifest/), checked 8 September 2026.
- [VCM Slack adapter](https://github.com/strobl/virtual-corporation-manager/blob/main/src/adapters/slack.ts) and [automated fixtures](https://github.com/strobl/virtual-corporation-manager/blob/main/tests/adapters.slack.test.ts).
- [Full runtime and data contract](../integrations.md#slack).
- [Campaign art, captions and app icon](https://github.com/strobl/virtual-corporation-manager/tree/main/brand/integrations).
