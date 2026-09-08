# Bring your VCM team into Buzz.xyz

Give your agents a room. VCM exports the active AI roles assigned to your selected corporation, including their instructions and responsibilities, as a native Buzz team snapshot.

**Status:** configuration export is implemented. A historical native import was observed in Buzz 0.5.8 with two roles left stopped. Compatibility with your installed Buzz release and live task execution require separate checks. Humans, booked hours, work history and company ownership are not transferred as Buzz agents.

## Export and preview

1. In VCM, select a corporation with at least one active AI-agent member. Open **Tools → Connections → Export Buzz team**.
2. Open Buzz Desktop. Use **Agents → Agent teams → Import** and select the downloaded `.team.json`.
3. Inspect the preview: names, roles, instructions and responsibilities. Confirm the intended import once. A new import creates identities; repeating it can create duplicates.
4. Check each imported agent's effective provider, model and runtime before starting it through Buzz's own controls. The export requests Codex, one worker per identity, empty memory and owner-only response policy. Your installed Buzz version may display inherited runtime defaults.

Import is configuration transfer. It does not start agents. Team/profile metadata may synchronize to your configured Buzz relay. Use the [VCM agent avatar](https://github.com/strobl/virtual-corporation-manager/blob/main/brand/integrations/exports/07-buzz-agent-avatar.png) when manually setting a profile image; VCM's team export does not embed an avatar.

## Optional task connection

Use the [exact environment contract](../integrations.md#buzz) to configure the Buzz CLI path, relay URL, channel ID, VCM-agent-to-Buzz-public-key map and supported secure sender credentials. Keep secrets in the local connection environment. VCM does not read a dotenv file automatically.

The sending identity and target agent must belong to the intended channel. The agent must be running, and its response policy must allow the sender. In VCM, open **Tools → Agent runs & records**, select the intended AI agent and choose **Buzz** as the transport for one explicit bounded task.

VCM records relay acknowledgment, then waits for the mapped agent's response in the dispatch thread with the exact task reference. Relay acceptance is not completion. If delivery is uncertain, inspect that task's channel thread before an explicit retry; VCM does not automatically resend.

## First useful check

For a channel and sender you control, try a small text-only brief: “Rewrite this sentence in 12 words or fewer, preserving the meaning: Our three-person studio builds internal tools for small teams.” Review the actual output and its task reference in both VCM and Buzz. A successful setup needs a useful result, not just an imported role or a message acknowledgment.

## Sources and assets

- [Buzz.xyz](https://buzz.xyz) and [official Buzz repository](https://github.com/block/buzz).
- [Native team snapshot schema](https://github.com/block/buzz/blob/main/desktop/src-tauri/src/managed_agents/team_snapshot.rs).
- [VCM adapter implementation](https://github.com/strobl/virtual-corporation-manager/blob/main/src/adapters/buzz.ts) and [automated fixtures](https://github.com/strobl/virtual-corporation-manager/blob/main/tests/adapters.buzz.test.ts).
- [Campaign art, captions and avatar](https://github.com/strobl/virtual-corporation-manager/tree/main/brand/integrations).

Official Buzz source and the VCM implementation were reviewed on 8 September 2026. The historical native import is dated evidence, not a fresh live test.
