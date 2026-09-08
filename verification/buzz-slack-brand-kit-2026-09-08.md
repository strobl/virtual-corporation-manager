# Buzz.xyz + Slack brand kit verification — 8 September 2026

## Result

The README and brand kit now expose VCM's Buzz.xyz and Slack integration stories. Eight PNG/SVG assets, six draft posts, an offline gallery, dedicated setup guides and a Slack app manifest use the adopted VCM identity. The builder embeds existing wordmark/companion SVG bytes and the supplied Rubik font. Product runtime code, adapter behavior, data and versioned release archives are unchanged.

The implementation was based on `eab9268` (the Alpha.9 product-brand change). The current pull request's source revision identifies this addition. The new README image and setup guides are included in source-built npm packages; the editable brand kit stays in the GitHub source.

## Observed checks

- `npm run check`: TypeScript, 350 tests and production build passed on macOS arm64 / Node 24.19.0. Three opt-in checks were skipped. Automated fixtures are not live integration proof.
- `npm run test:package`: offline tarball installation, both CLI aliases, company creation, the 100-agent template, time precision/replay, restart, backup/restore and uninstall preservation passed.
- All eight PNGs rendered at their declared dimensions, with no text outside the canvas. Visual review covered the complete asset family, including mascot contrast and spacing between text and diagrams.
- The offline gallery loaded six draft posts and all images at 1440-pixel desktop and 390-pixel mobile widths without horizontal overflow. [Machine-readable report](../brand/integrations/evidence/render.json).
- Gallery interaction checks passed: copy-to-clipboard returns the exact draft, and PNG download returns `01-conversation.png`. The main brand gallery also fits at desktop and mobile widths after adding its integration link.
- Local Markdown links resolve. An npm dry-run confirms all five new guide/manifest/banner files are packaged and the editable brand kit is excluded.
- The four X drafts are below 280 weighted characters, with URL normalization recorded in the render report. Community messages remain longer drafts.
- The Slack manifest matches the adapter's documented setup: `app_mentions:read`, `chat:write`, `app_mention`, Socket Mode. The app-level `connections:write` token is configured separately by the operator. No secrets or account-specific identifiers are included.

The guides were checked against `src/adapters/buzz.ts`, `src/adapters/slack.ts`, `src/web/Work.tsx`, the existing integration contract, official Buzz source and Slack documentation. Source links are in the guides.

## Evidence limits

No Slack app was created or installed, no Buzz team was imported, no external message was sent and no provider task was started. The connection graphics are editorial illustrations. Buzz's historical native import and the existing adapter fixtures remain distinct from live useful-result acceptance. These assets do not close that acceptance gap. No npm package release or hosted-site deployment is part of this change.
