# Cloudflare / WAF Rules Template for V16

These rules require Cloudflare, hosting WAF, or server access. They cannot be enforced inside a static ZIP, but this template is ready for deployment.

## Recommended rules

1. Enable managed OWASP Core Ruleset.
2. Rate limit `/admin-login`, `/admin`, `/checkout`, and any future `/api/*` write endpoint.
3. Block obvious SQLi/XSS payloads using managed rules.
4. Challenge suspicious bot traffic.
5. Block non-GET/HEAD/POST methods unless the backend explicitly requires them.
6. Allow only expected countries/networks if this is a school internal demo.

## Example rate limits

- `/admin-login`: 5 POST attempts per 10 minutes per IP.
- `/checkout`: 30 POST attempts per 10 minutes per IP.
- `/api/*`: 120 requests per minute per IP for public endpoints.

Start in log/monitor mode, review false positives, then switch to block/challenge.
