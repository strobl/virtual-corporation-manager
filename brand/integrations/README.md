# Build the team. Bring it to Buzz.

The lead campaign starts in the real product: VCM’s Buzz export and the native Buzz team-import preview. Original Vic, tactile clay, large interface crops and the adopted VCM identity make the handoff visible.

![Build the team. Bring it to Buzz.](campaign/buzz-import-hero.png)

[The screenshot story and two campaign masters](campaign/README.md) · [Source record](campaign/provenance.json)

![Your setup. Comes with you.](campaign/buzz-export-to-import.png)

[Open the offline gallery](gallery.html) · [Copy-ready posts](COPY.md) · [Structured draft queue](posts.json) · [Product setup guides](../../docs/integrations/README.md) · [Main brand kit](../README.md)

## Lead campaign

Two screenshot-based raster masters, both 1672 × 941: [Buzz hero](campaign/buzz-import-hero.png) and [Export-to-import handoff](campaign/buzz-export-to-import.png). The generated compositions preserve the observed preview meaning; they are not untouched screenshots.

## Supporting assets

| Asset                               | Size        | Publish                                 | Edit                                    |
| ----------------------------------- | ----------- | --------------------------------------- | --------------------------------------- |
| Your team. In the conversation.     | 1600 × 640  | [PNG](exports/01-conversation.png)      | [SVG](exports/01-conversation.svg)      |
| Buzz.xyz — Give your agents a room. | 1600 × 900  | [PNG](exports/02-buzz-team.png)         | [SVG](exports/02-buzz-team.svg)         |
| Slack — A mention. A mission.       | 1600 × 900  | [PNG](exports/03-slack-mention.png)     | [SVG](exports/03-slack-mention.svg)     |
| Local roots. Open doors.            | 1600 × 900  | [PNG](exports/04-local-open.png)        | [SVG](exports/04-local-open.svg)        |
| Big ideas. Meet the channel.        | 1080 × 1080 | [PNG](exports/05-meet-the-channel.png)  | [SVG](exports/05-meet-the-channel.svg)  |
| VCM Slack app icon                  | 512 × 512   | [PNG](exports/06-slack-app-icon.png)    | [SVG](exports/06-slack-app-icon.svg)    |
| VCM Buzz agent avatar               | 512 × 512   | [PNG](exports/07-buzz-agent-avatar.png) | [SVG](exports/07-buzz-agent-avatar.svg) |
| Community announcement cover        | 1600 × 400  | [PNG](exports/08-community-cover.png)   | [SVG](exports/08-community-cover.svg)   |

Sizes are delivered formats. The announcement cover is an editorial asset, not a claim that either platform supports a particular profile-header placement. Use the square files for supported app/profile icon uploads. Uploads are manual; the Slack manifest and Buzz export do not install images.

## Use the story that matches the feature

**Buzz.xyz:** “Give your agents a room.” Explain team configuration export, native import preview and separate runtime setup. The exporter includes active AI agents assigned to the selected company; it does not transfer humans as agents or synchronize an entire corporation.

**Slack:** “A mention. A mission.” Explain the experimental single-owner/channel mention → local Codex → threaded text reply path. The chat-shaped artwork is an illustrated flow, not a screenshot or a completed task. This adapter does not post marketing assets or upload generated files automatically.

**Together:** “Your team. In the conversation.” VCM organizes the corporation locally. Connections are optional and need external setup. The brand line remains **Big ideas deserve a team.**

Four short posts and two community announcements are ready to copy with alt text. The Buzz posts now lead with the screenshot campaign. Every post is a draft. No publishing schedule, external message, platform installation, partner endorsement or live task execution is claimed.

## Reproduce and review

```sh
python3 brand/integrations/source/build.py
node brand/integrations/source/render.cjs
```

The builder uses Python's standard library. Rendering requires Node, Playwright and Chrome; set `VCM_PLAYWRIGHT_MODULE` to an existing Playwright installation when needed. The gallery opens directly from a downloaded source checkout and loads no external fonts, analytics or scripts.

The generator embeds the original SVG identity bytes from `brand/assets/` and the supplied Rubik font. It creates the supporting editable SVGs, merges the separately preserved screenshot campaign masters into the manifest, and builds the gallery and caption files. The renderer creates PNGs, refreshes the packaged README banner in `docs/images/`, checks text bounds and checks the gallery at desktop and mobile widths. [Original vector render report](evidence/render.json) · [Screenshot campaign verification](../../verification/buzz-screenshot-campaign-2026-09-08.md) · [Original kit verification](../../verification/buzz-slack-brand-kit-2026-09-08.md)

The existing repository license and [Rubik OFL notice](../assets/Rubik-OFL-1.1.txt) apply. No new third-party logo assets are used. Buzz.xyz and Slack are named as integration targets; these are independent VCM materials.
