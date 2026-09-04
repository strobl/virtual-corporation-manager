# GitFlash technical alpha page

Static HTML, CSS and SVG. Publish this directory as the GitHub Pages artifact. No build step, JavaScript, analytics, remote fonts or external page assets; GitHub links are ordinary navigation. Relative assets support the /gitflash/ subpath.

Serve this directory with any static HTTP server for local preview. The install command uses the direct release tarball documented in the repository README. The release owner verifies the version and asset exist before publication.

After publishing the verified release, deploy its matching reviewed `main` revision with `gh workflow run pages.yml --repo strobl/gitflash --ref main`. The Pages environment accepts `main`; release tags are not deployment sources. Verify the completed workflow and live HTML/CSS before calling the page updated.

The organization diagram is explicitly an illustration. Integration copy distinguishes actual Codex output, exercised Buzz native import, pending Buzz dispatch and pending Slack round trips. No human pilot, adoption metric, testimonial or hosted account service is claimed.
