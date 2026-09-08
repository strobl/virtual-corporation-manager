# Buzz screenshot campaign — 8 September 2026

Two screenshot-based campaign masters now lead the README and integration gallery: **Build the team. Bring it to Buzz.** and **Your setup. Comes with you.** They replace the abstract diagram as the main integration image, using the actual VCM export control, Buzz's native import preview and the adopted clay Vic characters.

## Source and visual checks

- Exported the public three-agent Patchwork example with VCM's real `exportBuzzTeam` function. Buzz Desktop 0.5.8 displayed the file in its native **Import team snapshot** preview, with Builder, Reviewer and Researcher. Cancelled the preview; no import confirmation, new identities, agent start or provider task.
- Captured the actual VCM Connections screen in an isolated fictional Alpha.9 workspace. The exported team file, original VCM screenshot, source hashes and composition details are in the [campaign source record](../brand/integrations/campaign/provenance.json).
- Reviewed both generated images at full resolution: correct role names and observed controls, recognizable VCM identity, legible headlines, no unrelated workspace labels, and explicit screenshot-composition labeling. Both masters are 1672 × 941 PNGs. The full native Buzz capture stays local because it includes unrelated workspace context.
- In the existing in-app gallery at 721 × 803, both campaign images loaded at their native dimensions, with six draft posts, ten assets and no horizontal overflow. Copy-to-clipboard returned the exact updated draft after completion.
- The generator retains the two raster campaign masters alongside eight editable vector assets. The renderer validates prebuilt PNG dimensions and preserves the new primary README image instead of replacing it with the earlier diagram.

Product runtime code and existing versioned releases are unchanged. The compositions show export and preview, not completed import or live task execution. The earlier kit's render report retains its original eight-asset scope.

## Repository checks

TypeScript, 350 existing tests and the production build passed; three opt-in checks were skipped. Offline packed-artifact acceptance passed on macOS arm64 / Node 24.19.0. All ten declared PNG dimensions and local Markdown links were checked. Both campaign downloads return the exact source bytes, and the packaged README image matches the selected hero master.
