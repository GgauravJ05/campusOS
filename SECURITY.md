# Security Policy

## Supported versions

| Branch | Supported |
| ------ | --------- |
| `main` | ✅        |
| `dev`  | ✅ (pre-release) |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Report privately through GitHub's
[private vulnerability reporting](https://github.com/GgauravJ05/campusOS/security/advisories/new),
or message the maintainer [@GgauravJ05](https://github.com/GgauravJ05) directly.

Include:

- what the vulnerability is and where (endpoint, file, page),
- steps to reproduce,
- the impact you believe it has.

You can expect an acknowledgement within **3 working days** and a fix or
mitigation plan within **14 days** for confirmed issues.

## What the project does to stay secure

- Passwords hashed with bcrypt; refresh tokens, OTPs and reset codes stored only as SHA-256 hashes.
- Short-lived access tokens; refresh tokens rotated on every use, with reuse detection.
- Rate limiting on every authentication endpoint.
- Parameterised SQL only; input validated on every endpoint.
- Security headers via Helmet; strict CORS allow-list.
- Immutable audit log enforced by the database.
- Dependency scanning with Dependabot and `npm audit` in CI.
