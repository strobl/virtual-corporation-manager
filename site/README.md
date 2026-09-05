# VCM repository fallback page

Static HTML, CSS and native SVG. This directory is the repository fallback page source, separate from the CMO-owned Lovable draft. It has no build step, JavaScript, analytics, remote fonts, uploads or task execution. Relative assets support a repository subpath such as `/gitflash/`.

The public identity is **VCM — Virtual Corporation Manager** and the headline is **Run a task. Review the result.** Four distinct links explain the corresponding installed actions: **Run a task**, **Review results**, **Track delivery hours**, **Set up a company**. Each guide names the input, output and actual next action. The primary website setup action is **Set up locally**; the website does not impersonate a hosted tool.

## Candidate and release boundary

This source describes **local release candidate `0.1.0-alpha.3`, prepared 5 September 2026**. At preparation it is **UNPUBLISHED**. Its installation commands require the supplied `gitflash-0.1.0-alpha.3.tgz` archive and matching handoff SHA-256. There is no public alpha.3 download link until release publication is verified. At preparation, the existing public `v0.1.0-alpha.2` remains unchanged; its link is explicitly historical and does not promise the VCM screen, Time Tracker or Product Studio company workflows. Technical repository, package, CLI and default data identifiers remain `gitflash`.

`virtualcorporationmanager.com` is the selected target text. At preparation on 5 September 2026, registration, ownership, DNS, TLS and live deployment remain unverified. Do not add a canonical URL or claim this page is live until the actual destination is verified. GitFlash's existing FDE site and domains remain unchanged.

The VCM wordmark and favicon are byte-for-byte copies of `public/vcm-wordmark.svg` and `public/vcm-favicon.svg`. White surfaces, a blue action accent, system typography and visible keyboard focus match the product candidate. Retained older F-mark assets are not referenced by this page.

## Review before publication

Serve this directory through a static server for local review. Check desktop and mobile layouts, keyboard navigation, true 200% zoom, relative assets under a repository subpath, every local anchor and the exact supplied install commands. These are required review checks, not claims of completed visual acceptance.

Preparing, serving or reviewing these files does not publish them. Keep the existing release, public `main`, Pages configuration, repository About/Homepage fields and domains unchanged during candidate review.

At an explicitly authorized release, the owner should:

1. Verify the final source revision, release tag, archive checksum and actual downloadable asset. Update candidate copy and installation links to that exact release; recheck runtime requirements and task routes.
2. Coordinate the final page owner and destination with CMO and PMO. Do not deploy this fallback page over the separate Lovable project or the GitFlash FDE site.
3. Review repository About text for the VCM descriptor. Set the Homepage field only after the actual VCM destination has been verified; the technical repository name need not change.
4. Inspect the current Pages workflow, allowed branch and environment before dispatch. If this fallback remains the chosen deployment, deploy the approved revision and verify the completed job plus live HTML, CSS, SVGs and task/setup links.
5. Verify domain ownership, DNS, TLS and target content separately. Keep unrelated existing domains intact. Record the live URL and evidence before calling the VCM site published.
