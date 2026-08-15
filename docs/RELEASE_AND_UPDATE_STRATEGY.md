# Release and update strategy

## Channels

| Channel | Artifact | Rollout | Rollback |
| --- | --- | --- | --- |
| Web/PWA | immutable versioned static bundle + public runtime config | fabricated staging, UAT, percentage/controlled production | redeploy previous compatible bundle and invalidate shell cache safely |
| API | versioned server artifact | staging contract/security tests, then controlled production | previous compatible artifact or forward fix; database rollback only when explicitly proven safe |
| Android | signed AAB | internal, closed, then production track | halt rollout; publish corrected higher version code |
| iOS | signed archive | TestFlight internal/external, phased/approved App Store release | halt phased release; submit corrected higher build/version |
| Windows PWA/MSIX | web deployment or signed package | enterprise pilot/Store flight | web rollback or prior supported package/update policy |

## Compatibility rules

- `/api/v1` remains backward compatible for every supported client. Breaking changes require a new API version and overlap period.
- The server reports release/minimum-client policy. Forced upgrades are reserved for security or incompatible data contracts and must show a clear recovery path.
- Database changes use reviewed forward migrations, expand/migrate/contract sequencing and restore-tested backups; clients never run migrations.
- Mobile binaries contain only public API/app identifiers and non-secret feature configuration. Secrets remain server-side.
- Each release has an owner, change record, test evidence, dependency/security scan, migration assessment, release notes, monitoring plan and rollback decision.

## Versioning and notes

Use semantic product versions plus monotonically increasing Android `versionCode` and Apple build number. Record web/API build identifiers independently. Release notes list customer-visible improvements, operational changes, migration/configuration needs, known limitations and rollback compatibility without exposing sensitive implementation details.

## Service worker and cache

Cache public shell assets only, bypass authenticated API/document responses, version caches, remove obsolete caches after activation and provide a safe refresh message when a new release is ready. A failed update must leave the last complete shell usable; workflow mutations still require the server.

## Ownership

Rhomberg owns product approval and communication. Innovate IT owns approved infrastructure, secrets, deployment, monitoring, backups and incident response. Named mobile/Store account owners control signing and submission. No automatic production promotion is permitted without the agreed approvals.

