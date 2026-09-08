# Alpha.9 product brand verification — 8 September 2026

## Result

The running product now uses the same visual system as the VCM brand kit: original wordmark and V-shaped companion, Rubik Bold, cream, orange, cobalt, mint and butter. The company index, first-company journey, navigation, company/member screens, dialogs and Time Tracker use the new presentation. Palette definitions are consolidated in shared tokens. All assets remain local and the Rubik OFL notice stays bundled.

No schema, company operation, review logic, delivery-hours calculation, provider dispatch or storage identifier was changed. Human and agent records remain explicitly distinguished. The companion is decorative editorial artwork.

## Observed checks

- TypeScript, all 350 existing tests and the production build passed; three optional live checks remain skipped locally. Exact cross-platform results belong to the source revision's CI run.
- Packed installation and acceptance passed, including offline npm installation, CLI aliases, local assets, company creation, delivery-hours precision, restart, SQLite backup/restore and retained history.
- In the mounted browser, inspected desktop widths of 1280 and 1440 pixels and a 390 × 844 mobile viewport. First-company creation and human/agent creation completed through their review dialogs in an isolated workspace. A separate isolated copy booked a 0.5-hour entry through the Time Tracker.
- Company lists, member details, reporting controls, company review and entry forms rendered with the new brand. A deliberately long agent name wrapped within the mobile inspector. No page-level horizontal overflow occurred at 390 pixels; the 850-pixel weekly table scrolled inside its 350-pixel region.
- Mobile navigation contained Tab/Shift+Tab and returned focus to its opener on Escape. The final member form fit within the mobile viewport.
- The local Rubik font and all visible SVG images loaded. Original wordmark, icon and companion copies match the canonical brand assets byte for byte.

The [product screenshots](../docs/images/product-brand-provenance.json) identify their source-file and built-asset hashes. Example records are fictional. Historical Alpha.7 screenshots and Alpha.8 acceptance retain their original provenance.

The versioned release manifest binds the final source revision, archive and checksum. This visual update does not close the separately documented experimental Product Studio execution limits.
