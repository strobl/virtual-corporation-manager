# Security

GitFlash is intended for a single local owner. Its default server binds only to loopback and rejects foreign-origin requests. Do not expose it using a tunnel or reverse proxy. Company backups and runtime outputs may contain confidential information; protect them like source code and business documents.

Optional runtimes have their own trust boundary. The initial Codex executor uses read-only sandbox mode and a task-specific directory; this restricts tool-driven writes, but it is not a separate operating-system user or a guarantee that all other local files are unreadable. Submit only information you intend to share with your chosen model provider. GitFlash does not supply model access or make optional inference free.

Never put tokens or passwords in company definitions. Integration credentials are supplied through the documented local environment; they are not browser settings or portable template fields. Do not commit them or include them in screenshots.

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/strobl/gitflash/security/advisories/new), which is enabled for this repository. Include a minimal reproduction without unrelated private data. Security fixes receive priority; no response-time guarantee is promised.

On Windows, files inherit the selected directory’s OS ACLs; GitFlash does not guarantee Unix-style permission bits or create a separate Windows ACL policy. Choose a private user-owned data directory.
