# MFA Backend Requirements

True MFA cannot be enforced securely in a static frontend-only package. Implement it in the backend or identity provider.

Minimum production requirements:

- Require MFA for administrator accounts.
- Prefer TOTP authenticator apps or WebAuthn/FIDO2 security keys.
- Store recovery codes hashed server-side.
- Rate-limit MFA attempts.
- Log MFA enrollment, disable, recovery, and failed attempts.
- Never store MFA secrets in browser localStorage.
