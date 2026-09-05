# VCM licensing

VCM uses an MIT-licensed core with a separate licensing path for optional, newly developed Enterprise components. The complete current VCM application core is available under the [MIT License](../LICENSE). This document explains the product model; it does not replace the license or add conditions to its permissions.

## The complete current core is MIT licensed

The core includes corporation and department management, agents and responsibilities, reporting relationships, the Time Tracker and its current catalog and history features, company import and export, backups, and the current security and recovery capabilities. The application code for the other features currently shipped in the core is also MIT licensed. Third-party materials retain their own licenses and notices, as described below.

The product policy is to keep this complete current core under MIT and develop optional Enterprise additions separately. Existing core functionality is not an Enterprise entitlement and is not moved behind a paid license as part of this model.

Under MIT, you may use the core for personal, internal business or commercial purposes; modify it; run a fork; host it, including as a paid service; distribute it; sublicense it; and sell copies. The core has no Enterprise license fee, company-size threshold, user-count limit or revenue restriction. Include the MIT copyright and permission notice in copies or substantial portions of the software, as required by the license. You do not have to publish your modifications under MIT merely because they modify MIT-licensed code.

These are license permissions, not promises about supported deployment modes. The current core is designed for one operator on a local machine. Permission to host it does not establish multi-user support or make network exposure secure; consult the [security guidance](../SECURITY.md) and [architecture documentation](developer-architecture.md) for the actual technical boundaries.

## Optional Enterprise components

New Enterprise functionality may be offered under a separate commercial license. The preferred boundary is a separate repository and package, with a clear component inventory and its own license. The MIT core remains independently usable. An Enterprise package must identify which new components the commercial terms cover and preserve the applicable licenses and notices for the core and other third-party material it includes.

Possible additions include organization-wide administration, identity-provider integration, centralized governance, fleet management or managed operations. These are product possibilities, not features delivered by this licensing document or claims about the current release. Availability, supported behavior and commercial terms must be documented for each actual offering.

An Enterprise license applies only to the components it expressly covers. It is not required simply because a company uses the MIT core, runs many copies, earns revenue, modifies it, or hosts it for others in compliance with MIT.

MIT permits proprietary reuse and sublicensing subject to its notice requirement. Existing MIT grants are not withdrawn by changing a filename, moving code to another directory or publishing a later version under different terms. The VCM product policy is to build new Enterprise functionality separately, rather than treating existing core functionality as newly restricted code.

Source visibility and open-source licensing are separate facts. If Enterprise source is made public under a commercial or restrictive license that does not meet the Open Source Definition, it must be described as source-available, not as OSI-approved open source. Its actual license controls what users may do with it.

## Support and services

Implementation assistance, private integrations, maintenance, support or hosting can be provided under separate contracts. Paying for those services is not a condition of exercising the MIT core permissions. A service agreement must describe the work, support commitments and any separately licensed deliverables it actually includes. This document does not create a support SLA, warranty or Enterprise service commitment.

## Contributions

Contributions intended for the MIT core are submitted under the repository's MIT License. Contributors retain their copyright. A routine core contribution does not require copyright assignment or a separate contributor license agreement. Contributors must have authority to submit their contribution under MIT and must identify third-party code or assets, their sources and their applicable licenses and notices. See [Contributing](../CONTRIBUTING.md).

Work on a separately licensed Enterprise component requires an explicit contribution or development agreement appropriate to that component before it is accepted. That agreement must establish the rights needed for its intended distribution and commercial licensing, including employer or contractor rights where relevant. The core contribution policy is not a blanket assignment of rights for future Enterprise work.

## Third-party materials and existing releases

Dependencies, adapted components, fonts, icons and other third-party materials retain their applicable licenses. The application license and any future Enterprise agreement do not override those terms. Consult [Third-party notices](../THIRD_PARTY_NOTICES.md) and any component-specific notices included with the relevant release.

Previously distributed MIT releases remain available under their MIT grants. Later product plans, commercial offerings or contribution-policy changes do not retroactively add payment, hosting or usage restrictions to those grants. Consult the license and notices shipped with the exact release or component you use.
