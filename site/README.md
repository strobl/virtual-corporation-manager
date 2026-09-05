# GitFlash technical alpha page

Static HTML, CSS and SVG. Publish this directory as the GitHub Pages artifact. No build step, JavaScript, analytics, remote fonts or external page assets; GitHub links are ordinary navigation. Relative assets support the /gitflash/ subpath.

Serve this directory with any static HTTP server for local preview. The install command uses the direct release tarball documented in the repository README. The release owner verifies the version and asset exist before publication.

After publishing the verified release, deploy its matching reviewed `main` revision with `gh workflow run pages.yml --repo strobl/gitflash --ref main`. The Pages environment accepts `main`; release tags are not deployment sources. Verify the completed workflow and live HTML/CSS before calling the page updated.

The organization diagram is explicitly an illustration. Integration copy distinguishes actual Codex output, exercised Buzz native import, pending Buzz dispatch and pending Slack round trips. No human pilot, adoption metric, testimonial or hosted account service is claimed.

## Local branding candidate

The Flash character and compact mark are copied from the application's own `public/` SVGs; `favicon.svg` is the same dark monochrome 16px silhouette as `public/flash-favicon.svg`. These are local assets with relative URLs. System fonts, warm canvas, dark company/install panels and the shared ink/amber/teal palette form the accepted local design direction. Product, Marketing and Customer Care in the diagram are illustrative roles, explicitly separate from the shipped 20/100-role software delivery templates.

This branding revision is a local review candidate, not a released product version. The install command and release link intentionally continue to identify the actually published `v0.1.0-alpha.2`. Preparing or serving this folder locally does not authorize a push, Pages deployment, release or replacement of that public tarball. Root owns actual rendered review at desktop, 390px and true 200% zoom, as well as reduced-motion and under-path asset checks before any later approved publication.
