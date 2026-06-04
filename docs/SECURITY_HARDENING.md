# Security Hardening

This document records repository-side safeguards and the admin checks that must be
completed in GitHub, Vercel, and Supabase. Do not place real secrets in this repository,
issues, pull requests, logs, or screenshots.

## Local-Only E2E Auth Bypass

The deterministic E2E sign-in path is for local development and automated tests only.
The Playwright configuration supplies these flags to its local development server:

```bash
NEXT_PUBLIC_E2E_AUTH_BYPASS=1
E2E_AUTH_BYPASS=1
NEXT_PUBLIC_LOCAL_TEST_SIGN_IN=1
```

The runtime guard permits the bypass only for `NODE_ENV=development` or `NODE_ENV=test`.
It disables the browser and server bypass for unknown modes, `NODE_ENV=production`,
`VERCEL_ENV=preview`, or `VERCEL_ENV=production`, even if the bypass flags are
accidentally set.

## Hosted Variables That Must Never Be Set

Confirm that these variables are absent from every Vercel preview and production
environment:

- `E2E_AUTH_BYPASS`
- `NEXT_PUBLIC_E2E_AUTH_BYPASS`
- `NEXT_PUBLIC_LOCAL_TEST_SIGN_IN`
- `NEXT_PUBLIC_OPENROUTESERVICE_DEBUG`

The route debug flag is also disabled by the runtime guard in restricted environments.
Do not enable hosted E2E bypasses to work around authentication or smoke-test failures.

## GitHub Admin Checklist

### Secret Scanning And Push Protection

- Enable GitHub secret scanning for the repository.
- Enable push protection for contributors and repository administrators.
- Review and resolve all existing secret-scanning alerts.
- Require documented justification for any bypass and review it promptly.
- Revoke and rotate any credential that is ever committed or exposed.

### Dependabot Alerts

- Enable Dependabot alerts and security updates.
- Review alerts at least weekly and assign an owner.
- Prioritize exploitable runtime dependencies and internet-facing paths.
- Verify Dependabot pull requests with `npm test`, `npm run lint`, and `npm run build`.

### Main Branch Protection

- Require pull requests before merging to `main`.
- Require at least one approving review and dismiss stale approvals.
- Require status checks for tests, lint, and build.
- Require conversation resolution before merging.
- Block force pushes and branch deletion.
- Restrict administrative bypasses and review the bypass list regularly.

## Cloud Access Checklist

### Vercel

- Grant the minimum project role needed for each person and integration.
- Restrict production deployments and environment-variable changes.
- Keep preview and production variables scoped separately.
- Confirm local-only and debug flags are absent after configuration changes.
- Remove inactive members, tokens, and integrations promptly.
- Stay within hobby/free-tier limits; pause before enabling paid features.

### Supabase

- Grant the minimum organization and project role needed.
- Keep service-role credentials server-only and out of browser-exposed variables.
- Use row-level security for user-owned data and review policies after schema changes.
- Remove inactive members and rotate exposed credentials promptly.
- Review auth settings, API access, and database logs regularly.
- Stay within free-tier limits; pause before enabling paid features.
