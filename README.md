# GitFlash

Build your company of AI agents.

GitFlash is a free, open-source local workspace for configuring a company, understanding its departments and agents, and tracing real work to the people and tools that produce it. VCM (Virtual Corporation Manager) is the internal product name.

**Development status:** the local rebuild is in progress. An installable release and supported integration claims will be documented after packaged acceptance. The historical cloud prototype is a separate, private source; its history and data are not part of this repository.

The local core is designed to run without accounts, hosted databases, cloud inference or telemetry. Optional external runtimes and services have their own prerequisites and costs. Configuring 100 agents does not mean running 100 agents simultaneously.

## Delivery

The first acceptance path is terminal → local browser → create company and agent → SQLite → restart → recover the same data. Subsequent increments add coherent organization views, reviewed configuration changes and undo, useful integration output, recovery and a tested public package.

Code and technical decisions are maintained here. Requirements and work orders are managed in the dedicated GitFlash open-source rebuild project in 8090. Venture planning remains separate from verified product completion.
