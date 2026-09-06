# PS-001 — Stock alert export

**All organizations, products and data are synthetic.** Client: Meadow Tools; recipient: its inventory coordinator. Outcome: prepare a reviewable local utility that tells the coordinator which products need replenishment. No purchase, email, production deployment or connection to a real inventory system.

Input: `input.json`, an array of products `{sku, stock, reorder_point}`. Deliver a Python standard-library function `reorder_items(products)` in `stock_alert.py`, runnable tests, `expected.json`, a short usage note and criterion-level QA record. Work only in this example folder. No third-party dependencies.

Acceptance:
- PS-A1: Include a product only when stock is strictly less than reorder_point. At equality, omit it.
- PS-A2: Quantity is reorder_point minus stock, integer; emit `{sku, quantity}` sorted by SKU in ascending lexicographic order. Do not modify the input.
- PS-A3: SKU is a nonempty string with no surrounding whitespace and unique, case-sensitive. stock/reorder_point are integers >=0; booleans are invalid. Invalid input raises ValueError before returning any result. Empty product list returns [].
- PS-A4: Required fields must exist, input must be a list and each product a dictionary. Additional fields may exist and are ignored. Unicode SKUs are allowed; Python lexical order applies.
- PS-A5: Evidence includes normal, threshold, empty, invalid, duplicate and non-mutation cases. No claims about a real customer, money saved or deployment.

Accountable: PS-DM. Producer: PS-BUILD. Requirements: PS-REQ. Independent reviewer: PS-QA. Handoff: PS-DOC. Human owner decides conflicting rules, scope changes and final acceptance. Initial candidate plus at most two repairs. Simulated review deadline: next fixture review checkpoint; no real deadline or spend commitment.

Fixture authorization: local example work only, resource ceiling standard library/local files; no external calls. The desired output is predetermined by these synthetic acceptance criteria, not by actual customer acceptance. Final state must remain waiting_owner until actual acceptance; example transitions can separately show a synthetic owner decision.
