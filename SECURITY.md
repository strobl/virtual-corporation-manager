# Security

GitFlash is intended for a single local owner. Its default server binds only to loopback and rejects foreign-origin requests. Do not expose it using a tunnel or reverse proxy. Company backups and runtime outputs may contain confidential information; protect them like source code and business documents.

Optional runtimes have two explicit execution routes. **Individual tasks** use the original read-only Codex sandbox and return text. **Company jobs** use separate Codex sessions with workspace-write permissions inside fresh stage directories; they may create files and run local commands. Company-job shell networking, web, apps, plugins and delegation are disabled, and no approval-bypass fallback is used. Neither route creates a separate operating-system user or guarantees that unrelated local files are unreadable. Submit only information you intend to share with your chosen model provider. GitFlash does not supply model access or make optional inference free.

Before a company job dispatches a model stage, a fixed local checker verifies Python and sandbox availability. Its separate temporary Codex configuration has no copied login and disables networking. The workflow is unavailable on native Windows; the local company and Time Tracker features remain separate. See [runtime prerequisites and observed platform limits](docs/product-studio.md).

The workflow accepts bounded UTF-8 artifacts with safe relative paths, rejects links/devices and checks immutable input hashes. Runtime session receipts and command events are observed evidence; model-written claims are not test results or owner decisions. A reviewed candidate requires a successful independent fixed oracle and separate QA before explicit owner review. Severe evidence contradictions stop ordinary repair. Jobs, exact artifact bytes and delivery-hours history are stored in plaintext SQLite and included in full backups. Protect backups and exported evidence; do not upload them to public issues.

Never put tokens or passwords in company definitions. Integration credentials are supplied through the documented local environment; they are not browser settings or portable template fields. Do not commit them or include them in screenshots.

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/strobl/gitflash/security/advisories/new), which is enabled for this repository. Include a minimal reproduction without unrelated private data. Security fixes receive priority; no response-time guarantee is promised.

On Windows, files inherit the selected directory’s OS ACLs; GitFlash does not guarantee Unix-style permission bits or create a separate Windows ACL policy. Choose a private user-owned data directory.
