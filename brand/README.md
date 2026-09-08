# VCM brand kit

**Big ideas deserve a team.**

The adopted VCM identity, ready for GitHub and social: original VCM wordmark, warm cream, orange, Rubik Bold and the V-shaped companion. The source mascot name is Vic. The product is always **Virtual Corporation Manager**.

![VCM campaign](exports/09-team-sculpture.png)

## Use it

- [VCM on X: @virtualcorpman](https://x.com/virtualcorpman)
- [X profile fields and upload files](content/X-PROFILE.md)
- [Twelve launch posts and pinned introduction](content/LAUNCH-POSTS.md)
- [Structured draft queue with alt text](content/posts.json)
- [Three-series content rhythm and Pressmaster handoff](content/CONTENT-ENGINE.md)
- [Buzz.xyz + Slack integration assets and post drafts](integrations/README.md)
- [Brand brief](content/BRAND-BRIEF.md)
- [Offline gallery](gallery.html) — download the kit and open this HTML file locally.

Public values: **Play 2 win · Be adaptable · Never stop hacking · Hackers first · Be open.**

## Assets

Use PNG for publishing. SVGs retain editable text and embedded Rubik Bold; logos are original vector paths. All alt text and dimensions are also in [manifest.json](manifest.json).

| Asset                     | Size        | PNG                                         | Editable SVG                                |
| ------------------------- | ----------- | ------------------------------------------- | ------------------------------------------- |
| X profile photo           | 400 × 400   | [PNG](exports/x-avatar.png)                 | [SVG](exports/x-avatar.svg)                 |
| Community mascot avatar   | 800 × 800   | [PNG](exports/mascot-avatar.png)            | [SVG](exports/mascot-avatar.svg)            |
| X header                  | 1500 × 500  | [PNG](exports/x-header.png)                 | [SVG](exports/x-header.svg)                 |
| GitHub social preview     | 1280 × 640  | [PNG](exports/github-social-preview.png)    | [SVG](exports/github-social-preview.svg)    |
| README hero               | 1600 × 640  | [PNG](exports/readme-hero.png)              | [SVG](exports/readme-hero.svg)              |
| X launch / org chart      | 1600 × 900  | [PNG](exports/01-show-your-team.png)        | [SVG](exports/01-show-your-team.svg)        |
| X educational post        | 1600 × 900  | [PNG](exports/02-team-recipe.png)           | [SVG](exports/02-team-recipe.svg)           |
| X product walkthrough     | 1600 × 900  | [PNG](exports/03-name-your-corporation.png) | [SVG](exports/03-name-your-corporation.svg) |
| X local-first positioning | 1600 × 900  | [PNG](exports/04-your-machine.png)          | [SVG](exports/04-your-machine.svg)          |
| X product distinction     | 1600 × 900  | [PNG](exports/05-people-and-agents.png)     | [SVG](exports/05-people-and-agents.svg)     |
| X culture / contribution  | 1600 × 900  | [PNG](exports/06-never-stop-hacking.png)    | [SVG](exports/06-never-stop-hacking.svg)    |
| X verified release update | 1600 × 900  | [PNG](exports/07-alpha8-release.png)        | [SVG](exports/07-alpha8-release.svg)        |
| X community prompt        | 1600 × 900  | [PNG](exports/08-first-three-roles.png)     | [SVG](exports/08-first-three-roles.svg)     |
| X campaign illustration   | 1600 × 1080 | [PNG](exports/09-team-sculpture.png)        | [SVG](exports/09-team-sculpture.svg)        |
| Story / Reel cover        | 1080 × 1920 | [PNG](exports/10-story-team.png)            | [SVG](exports/10-story-team.svg)            |
| Square social cover       | 1080 × 1080 | [PNG](exports/11-square-culture.png)        | [SVG](exports/11-square-culture.svg)        |
| README product model      | 1600 × 780  | [PNG](exports/readme-team-map.png)          | [SVG](exports/readme-team-map.svg)          |

## Source and production

The wordmark geometry, palette, Rubik font and V-shaped companion come from the adopted 6 September 2026 brand system. The team-sculpture illustration was generated on 8 September with the original character master as its reference. The illustration is a campaign asset, not a product screenshot, customer result or execution record. Original identity SVGs and the font's SIL OFL 1.1 notice are preserved in `assets/`.

Run `python3 brand/source/build.py`, then `node brand/source/render.cjs` with Playwright and Chrome available. Set `VCM_PLAYWRIGHT_MODULE` to your installed Playwright module if needed. Run `python3 brand/source/catalog.py` last to rebuild the gallery and catalog. These helpers do not change the application or publish to any platform.

The renderer verifies text bounds and output sizes. Visually review modified art at mobile size before publishing. Org-chart connections must describe the intended relationship: membership, reporting or ownership. Use the real product screenshot in the repository README when showing actual UI.

GitHub's [official social-preview guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview) specifies 1280 × 640 for best display and a file under 1 MB. The supplied preview is opaque PNG. X dimensions and profile rules are linked in the profile brief. Specifications checked on 8 September 2026.

The repository's license and the included third-party notices remain applicable. This kit makes no exclusive trademark or audience-performance claim.
