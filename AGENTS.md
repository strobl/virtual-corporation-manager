# GitFlash engineering

The source prototype outside this repository is read-only. Never copy its private history, .env, .lovable, Supabase migrations, credentials or customer data.

Public code, copy, documentation and commits use English. The local product requires no account, network, hosted inference, billing or telemetry. Keep public claims aligned with evidence.

Ownership: root owns shared contracts, CLI, server, package/build/CI, integration and release. Platform lead owns src/db, src/domain (except contracts.ts), src/company and domain tests. Frontend lead owns src/web, adapted src/components, src/lib, src/types and frontend tests. Integration lead owns src/adapters and adapter tests. Coordinate contract changes with root; never edit a sibling's files silently.

Use isolated module ownership on the integration branch. Root reviews all changes and runs the packed-artifact acceptance before publication. Do not commit or publish unless root assigns it.
