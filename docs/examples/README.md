# Three-agent example

[three-agent-studio.json](three-agent-studio.json) is a fictional company definition in the product's existing schema. **Patchwork Studio (example)** contains one Product department and three peer agents:

| Agent      | Responsibility                                            | Potential output when separately asked to work |
| ---------- | --------------------------------------------------------- | ---------------------------------------------- |
| Builder    | Implement a scoped release-notes change and record checks | Patch and test evidence                        |
| Reviewer   | Compare a supplied candidate with its requirements        | Review note with reproducible findings         |
| Researcher | Trace requirements to supplied sources                    | Source-backed requirement note                 |

The file configures these roles. It contains no executed work, accepted result, customer data, credential or booked time. No manager or company relationship is required. Do not count it as a real user's project or as activation.

## Import and inspect

Use the `0.1.0-alpha.9` archive through the [README installation route](../../README.md#install-the-reviewed-archive). The versioned release manifest binds the archive; alpha.5 and alpha.6 package evidence is historical. Follow [the quickstart](../developer-quickstart.md), then open **Settings → Import a company definition**. Select the JSON file or paste its full contents, choose **Review import**, inspect the changes and choose **Apply changes**. Open **Corporations → Patchwork Studio (example)**.

Select a member to inspect its role, instructions and responsibilities. Choose **Edit member**, make a focused change, then **Review change → Save member**. The company overview also supports **Add member** for an **AI agent** or **Human**; this shipped fixture contains only the three agents listed above. Saving a member does not execute work or book time.

The installed example is at `vcm-preview/node_modules/gitflash/docs/examples/three-agent-studio.json`. **Settings → Export company definition** exports the workspace's configuration. Importing that export creates fresh IDs and preserves existing companies; repeated import adds another company with a suffixed short code. A SQLite backup is the full recovery route.

## Change this example

Start with a concrete responsibility, instruction or role that makes the fictional project easier to understand. Keep references consistent with `src/domain/contracts.ts` and `validateDefinition` in `src/domain/model.ts`. The definition permits JSON configuration only: unknown fields, including work or credentials, are rejected. Keep the file below the UI's 5 MB limit.

After building the checkout, run:

```sh
npm run build
node docs/examples/verify.mjs
```

The verification script uses the actual built CLI on an ephemeral loopback port and a temporary workspace. It submits the example through the same preview/apply endpoints as the UI; checks fresh-ID import, saved edit, replay, export, restart and full backup/restore; and confirms no work, jobs or booked hours were created. It also checks an unsupported-field refusal. Temporary data is removed and no provider is dispatched. It prints JSON evidence and exits nonzero on failure. It does not replace a visual UI review or an independent human pilot.

The script ships in the installed package and defaults to that package's adjacent CLI and example, so the same check can run after the README's isolated install:

```sh
node ./vcm-preview/node_modules/gitflash/docs/examples/verify.mjs
```

To check another built/installed CLI or a proposed fixture, pass filesystem paths as the first and second arguments:

```sh
node docs/examples/verify.mjs ./dist/cli.js ./docs/examples/three-agent-studio.json
```

The fixture must contain at least one agent. The verifier adapts an instruction on the first imported agent and imports the exported configuration into a second workspace; it never targets an existing user directory. [Starter tasks](../developer-contributing.md) show how to propose a focused contribution without private planning access.
