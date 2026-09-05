# PS-001 requirements and verification matrix — v1.1

Source: brief.md PS-A1–A5. Prepared as an authored requirements example, not an independently executed requirements-agent step.

| Criterion | Check | Expected behavior |
|---|---|---|
| PS-A1 | Fixture records below/equal/above threshold | A-100 and M-300 included; B-200 and C-400 omitted |
| PS-A2 | Quantity/order; deep-copy comparison of input before/after | A-100:4, M-300:5; original input unchanged |
| PS-A3 | Empty list; duplicate SKU; blank/whitespace SKU; negative/fraction/string/null/bool values | [] for empty list; invalid inputs raise ValueError |
| PS-A4 | Non-list input, non-dictionary record, missing fields, extra fields, Unicode SKU | Invalid structures raise ValueError; extra fields ignored; Unicode accepted |
| PS-A5 | Inspect submitted files, check evidence and delivery language | Local synthetic artifact only; no unrun test or deployment claimed |

Validation is all-or-nothing: any invalid record fails the whole call. No partial result is returned or externally written. A boolean must be explicitly rejected despite Python's numeric subclass behavior.

Scope decisions: fixture author explicitly chose case-sensitive uniqueness, lexical ordering, strict below-threshold selection and ignored extra fields. These are synthetic requirements, not deductions about real inventory operations.
