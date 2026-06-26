# V16 Live Deployment Runbook

This package completes the items that can be completed inside the static website ZIP. The remaining items require access to the real hosting provider, domain, or third-party services.

## Deploy checklist

1. Upload the full V16 folder to Netlify, Vercel, Apache, or equivalent static hosting.
2. Enable HTTPS/SSL on the host. Use the included `_headers`, `vercel.json`, or `.htaccess` security header configuration.
3. Confirm `https://YOUR_DOMAIN/site-version.json` returns `20260526v20`.
4. Open `/orders` and create or load multiple long timeline orders. Confirm no overlap.
5. Run `python tests/run_all_v16.py --root .` from the deployed folder before publishing.
6. After deployment, run the same script with `--base-url https://YOUR_DOMAIN` to check live headers and important routes.
7. Configure Sentry if available, then test `window.SGFV16.runSelfCheck()` in DevTools.
8. Run GTmetrix/WebPageTest/Lighthouse using the public URL.
9. Run BrowserStack manual matrix from `browserstack/BROWSERSTACK_TEST_PLAN_V16.md`.

## Unrealizable inside this ZIP alone

- Issuing the real TLS certificate.
- Deploying to your live host.
- Running BrowserStack real devices.
- Running GTmetrix/WebPageTest against a public URL.
- Enforcing real backend MFA, password policy, SQL injection prevention, and WAF rules.

The package includes templates or guards for these items so they are ready when the live environment exists.
