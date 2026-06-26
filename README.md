# Skibidi GoFood

A campus food-ordering web app built for MMU (Multimedia University) students and staff.

## Registration rules

Registration is restricted to official MMU email addresses only:

- `@mmu.edu.my` — staff
- `@student.mmu.edu.my` — student

Login is not affected by this restriction — existing accounts can sign in
with their username, student ID, or email, regardless of domain. The
relevant logic lives in `js/auth.js` (`validateMMUEmail`, `isAllowedMMUEmail`).

## Project structure

- `*.html` — pages (home, menu, cart, checkout, profile, admin, etc.)
- `js/` — application logic (auth, cart, orders, state management, Supabase sync)
- `css/` — stylesheets
- `images/` — static assets
- `api/` — Vercel/Node serverless functions (AI proxy)
- `netlify/functions/` — Netlify serverless functions (AI proxy)
- `tests/` — automated checks (including a secret-leak scanner)
- `ops/`, `browserstack/`, `edgeone/`, `waf/` — deployment and operations docs

## AI proxy / Groq key

The Groq API key is **never** committed to source. The serverless proxy
files (`api/sgf-ai.js`, `netlify/functions/sgf-ai.js`) read it from the
`GROQ_API_KEY` environment variable on your hosting provider. See
`ops/DIRECT_GROQ_KEY_V19_NOTICE.md` for setup instructions.

## Deploying

This is a static site with two serverless function targets:

- **Netlify**: configured via `netlify.toml`, `_headers`, `_redirects`
- **Vercel**: configured via `api/` functions

Set `GROQ_API_KEY` (and optionally `GROQ_MODEL`) as environment variables
on whichever platform you deploy to — see `scripts/netlify-env-commands.txt`
or `scripts/vercel-env-commands.txt`.

## Pushing this repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```
