# VCM technical site

Static technical landing page and documentation for **VCM — Virtual Corporation Manager**. The approved developer-first headline is **Your agent company. On your machine.** The primary action is **Install VCM**, with **Read the docs** beside it. GitFlash remains the separate FDE boutique and legal operator; it is not the acquisition brand.

The site is plain HTML, CSS and a small progressive-enhancement script for clipboard feedback and image enlargement. No build, external font, analytics, upload, inference or account is required. Images, identity SVGs and the example JSON are bundled locally. It is independent of the separately accepted Lovable project.

## Serve and review

Serve `site/` using any static HTTP server. Directory routes are `./`, `./docs/` and `./imprint/`; every local resource uses a relative URL. It also works below a repository prefix such as `/virtual-corporation-manager/` without a router fallback. The existing Pages workflow uploads this directory directly.

Check the homepage and Docs install blocks, command-copy success/failure feedback, local example download, FAQ, responsive screenshots, image viewer Close/Escape/Tab/focus return, legal links and narrow-width overflow. Without JavaScript, all document and source links still work and product images open as ordinary image links. Clipboard failures give an honest manual-copy instruction.

## Alpha 5 candidate and release handoff

This source is prepared for `0.1.0-alpha.5`. It remains an **Alpha 5 release candidate** until Engineering verifies the published release and downloadable archive. The exact future target is:

`https://github.com/strobl/virtual-corporation-manager/releases/download/v0.1.0-alpha.5/gitflash-0.1.0-alpha.5.tgz`

The displayed command installs into `./vcm-preview` without lifecycle scripts, checks `vcm --version`, and starts with explicit `./my-company` data. Requires Node.js `>=24.14.0 <25 || >=26.0.0 <27` and npm. The download needs network access; installed local core operation does not. The package name remains `gitflash`; `vcm` is canonical and `gitflash` a compatibility alias. No public npm namespace is assumed.

Before deployment, the release owner must verify the exact source, tag, archive digest and download; execute the displayed commands against that archive; then reconcile the candidate label, download-availability text and version FAQ in `index.html` and `docs/index.html` with the actual result. Source preparation and local browser checks do not establish release publication. The CMO does not publish or commit this assignment.

## Product evidence and limits

The four original JPEGs are unchanged captures from the separately accepted local `0.1.0-alpha.5-local.1` product, source `bc3e6b1b5c0954f3d01764d18ea9dedfb3075733`, archive `c2d239f6168a61c0c6ea849d14aaf32db528e4867e72799ca57e3dea1410be9e`. They are not new captures of the alpha.5 release. `assets/PROVENANCE.json` binds the bytes and version. Patchwork is a fictional three-peer-agent configuration with no jobs or booked hours. Northstar shows illustrative recorded effort: desktop company week8.0h and mobile Alex filter2.5h. The captions preserve these distinctions.

A single local operator configures organizations. Configuration and reporting do not execute or delegate work automatically. Delivery hours are attributed human-equivalent effort, separate from runtime, savings, invoices and accepted output. Definition export reuses configuration with fresh identities on import; SQLite backup/restore preserves the whole workspace. Provider tools, credentials, sandbox requirements and platform restrictions remain separate from the local core.

No custom-domain ownership, DNS, TLS, adoption, outside contribution, pilot outcome, enterprise edition or guaranteed support is asserted. The header and footer use the reviewed vector identity, not the obsolete checkmark. Old unreferenced assets remain historical files only.

## Adopted licensing model

The 6 September 2026 Founder decision keeps the complete existing core under MIT, including commercial use, hosting and forks without a company-size threshold. Optional new Enterprise modules may be separately commercially licensed; inspectable proprietary code is not open source. Existing Time Tracker, export/recovery and core fixes remain MIT. The homepage FAQ and `docs/#licensing` explain this boundary; no current Enterprise availability, prices or support guarantee are asserted. The public source licensing document is integrated by the release owner alongside this site.
