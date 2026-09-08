# VCM naming and compatibility

The product is **Virtual Corporation Manager**, abbreviated **VCM**. Use these names in the interface, browser metadata, help, agent prompts, documentation, repository descriptions and new release titles. New command examples use **`vcm`**. The canonical repository is [strobl/virtual-corporation-manager](https://github.com/strobl/virtual-corporation-manager).

| Surface              | Contract                                                                                                                                                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command              | `vcm` is canonical; `gitflash` remains a compatibility alias for the same executable.                                                                                                                                                                            |
| Distribution         | The installed npm package remains `gitflash` for compatibility, including `node_modules/gitflash`; the visible GitHub download archive is named `vcm-<version>.tgz` and is produced by `npm run pack:release`. No availability of the npm name `vcm` is claimed. |
| Existing workspace   | Both commands resolve `--data-dir`, then `GITFLASH_DATA_DIR`, then the existing `~/.gitflash` default. No automatic directory move or workspace rewrite occurs.                                                                                                  |
| Environment          | Existing `GITFLASH_*` configuration settings retain their names and behavior.                                                                                                                                                                                    |
| Protocol and exports | Existing identifiers such as `X-GitFlash-Token`, export format names, package IDs, sandbox profiles and persisted database fields remain compatible. User-facing download filenames use VCM while payload identifiers stay unchanged.                            |
| Historical evidence  | Original outputs, source identifiers, hashes, migration statements, release assets and legal attribution retain their original bytes or provenance. Adapted current wording is recorded separately.                                                              |
| Separate FDE website | GitFlash's separate FDE website is unchanged; it is outside the VCM product rename.                                                                                                                                                                              |

These compatibility identifiers belong only where needed to identify the actual package, existing data, wire format or historical source. They are not the current product name. Existing user-entered company names, instructions, execution records and artifact bytes are never rewritten to enforce branding.

## Product visual system

The product shares the canonical assets in [`brand/assets`](../brand/assets) with the public brand kit. `public/vcm-lockup.svg` is the ink wordmark; `public/vcm-glyph.svg` and `public/vcm-favicon.svg` are the original icon; `public/vic.svg` is the original companion. Keep these copies aligned with their source files. They load from the local application, together with the bundled Rubik Bold font and its SIL Open Font License.

The shared tokens in `src/web/styles.css` define cream `#F6F3E8`, ink `#17252A`, orange `#FF5A2A`, cobalt `#2D4DF0`, mint `#A8DED0` and butter `#F7D85B`. Rubik Bold is for headings; system fonts remain in controls and working tables. Orange actions use ink text, cobalt selections retain visible focus, and work-status colors keep their semantic roles.

The companion adds personality to navigation and empty states. It never represents a saved member or an execution result. Human avatars remain circular and labelled Human; agent avatars remain rounded squares and labelled Agent. The product brand does not imply autonomous dispatch or change the existing company and delivery-hours contracts.
