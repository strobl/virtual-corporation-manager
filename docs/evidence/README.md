# Actual runtime output

These are real outputs produced by two configured roles through the installed Codex CLI, not seeded demo records. They concern a synthetic GitFlash acceptance company and contain no customer data. They are agent-authored working documents, not independent test certificates or human-pilot feedback.

| Role | Run ID | Duration | Output SHA-256 |
| --- | --- | --- | --- |
| Release Auditor | `723f7fd4-c01d-4002-a526-664ea6ec9f15` | 36.845 s | `d4736671f8ecbedbe8aa31180ddf2c69407715091c1f60098f54fe85e2df1c31` |
| Product Analyst | `23aac6dc-81d2-4903-9f41-08fb4112ed0a` | 36.978 s | `20522a42a7dd48c72800a9eda6fa34f2c983e61db7312871465b680fdfa9592e` |

The Product Analyst ran from a manually created company. The Release Auditor ran from the 100-role template in the offline-installed package. Both used Codex CLI 0.138.0 with the existing operator login. The task supplied product facts; the roles were instructed not to browse, contact anyone or claim independent testing.

Integrator review: the first draft incorrectly suggested a new publishing decision was necessary; the second corrected that. Its offline-install step assumes the tarball was downloaded first; fetching a public release requires network. Counts and pending checks describe the facts supplied at task time, not the final release state. The authoritative current outcome is the release acceptance document. Do not reuse either output verbatim as a release certification.
