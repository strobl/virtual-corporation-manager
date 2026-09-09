# VCM technical site

Static technical landing page and documentation for **VCM — Virtual Corporation Manager**. The current corporation-management headline is **Your company. People and agents together.** The primary action is **Install VCM**, with **Read the docs** beside it. Company identity, real members and responsibilities lead onboarding. GitFlash remains the separate FDE boutique and legal operator.

The site is plain HTML, CSS and a small progressive-enhancement script for clipboard feedback and image enlargement. No build, external font, analytics, upload, inference or account is required. Images, identity SVGs and the example JSON are bundled locally. It is independent of the separately accepted Lovable project.

## Serve and review

Serve `site/` using any static HTTP server. Directory routes are `./`, `./docs/` and `./imprint/`; every local resource uses a relative URL. It also works below a repository prefix such as `/virtual-corporation-manager/` without a router fallback. The existing Pages workflow uploads this directory directly.

Check the homepage and Docs install blocks, command-copy success/failure feedback, local example download, FAQ, responsive screenshots, image viewer Close/Escape/Tab/focus return, legal links and narrow-width overflow. Without JavaScript, all document and source links still work and product images open as ordinary image links. Clipboard failures give an honest manual-copy instruction.

## Alpha 11 command-cleanup handoff

This site accompanies the **0.1.0-alpha.11 technical release**. Publish the site only after Engineering verifies the actual release, public archive download and displayed installation commands. The exact release asset is:

`https://github.com/strobl/virtual-corporation-manager/releases/download/v0.1.0-alpha.11/vcm-0.1.0-alpha.11.tgz`

The primary command is `npx virtualcorporationmanager`; permanent installation is `npm install -g virtualcorporationmanager`, then `vcm`. The package installs only the `vcm` command. Requires Node.js `>=24.14.0 <25 || >=26.0.0 <27` and npm. The first download needs network access; the installed local core works offline. Advanced verified-archive installation and recovery remain in the docs.

Alpha 11 installs only the VCM command while retaining existing workspace data. Its release manifest binds the source, archive checksum, installation checks and upgrade verification. Earlier releases retain their original identities and evidence.

The install path leads with plain company setup and optional Human/Agent membership. The separate execution guide retains both actual Alpha 5 PS-001 intake timeouts: the initial attempt and one retry each failed after 300 seconds at `ultra`. No v2 delivery bundle or owner acceptance exists. The prior v1 download remains rejected for its missing expected-reference file; the current v2 acceptance and useful-result journey remain open. No further provider attempt or reasoning change is authorized by this copy update.

## Product evidence and limits

The company screenshots show fictional Linden Studio and its member inspector. Their captions and `assets/corporation-provenance.json` identify the actual captured source and viewport. They are native product captures, not generated product mockups. Fictional members and hours are not customer activity or default company content.

The original Time Tracker JPEGs remain unchanged captures from local `0.1.0-alpha.5-local.1`, source `bc3e6b1b5c0954f3d01764d18ea9dedfb3075733`, archive `c2d239f6168a61c0c6ea849d14aaf32db528e4867e72799ca57e3dea1410be9e`. `assets/PROVENANCE.json` binds those original bytes and version. Northstar shows illustrative recorded effort: desktop company week8.0h and mobile Alex filter2.5h. The Time Tracker remains functionally unchanged; these are not new Alpha 7 captures.

A single local operator configures organizations. Configuration and reporting do not execute or delegate work automatically. Delivery hours are attributed human-equivalent effort, separate from runtime, savings, invoices and accepted output. Definition export reuses configuration with fresh identities on import; SQLite backup/restore preserves the whole workspace. Provider tools, credentials, sandbox requirements and platform restrictions remain separate from the local core.

No custom-domain ownership, DNS, TLS, adoption, outside contribution, pilot outcome, enterprise edition or guaranteed support is asserted. The header and footer use the reviewed vector identity, not the obsolete checkmark. Unused legacy product branding assets have been removed from the current site and application; published older archives remain unchanged.

## Adopted licensing model

The 6 September 2026 Founder decision keeps the complete existing core under MIT, including commercial use, hosting and forks without a company-size threshold. Optional new Enterprise modules may be separately commercially licensed; inspectable proprietary code is not open source. Existing Time Tracker, export/recovery and core fixes remain MIT. The homepage FAQ and `docs/#licensing` explain this boundary; no current Enterprise availability, prices or support guarantee are asserted. The public source licensing document is integrated by the release owner alongside this site.
