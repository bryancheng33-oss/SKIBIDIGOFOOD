# Groq Key Handling — Current Status (V21+)

This project no longer embeds the Groq API key in any source file. The current
server-side proxy files read it from a hosting environment variable instead:

- `api/sgf-ai.js` (Vercel / Node runtimes) — reads `process.env.GROQ_API_KEY`
- `netlify/functions/sgf-ai.js` (Netlify Functions) — reads `process.env.GROQ_API_KEY`

The browser frontend only ever calls `/api/sgf-ai`; it never calls Groq directly,
so the key is never exposed to the client.

## Setting the key
Use your hosting provider's CLI or dashboard, never source code:

- Netlify: see `scripts/netlify-env-commands.txt`
- Vercel: see `scripts/vercel-env-commands.txt`
- Local dev: run `scripts/create-groq-env-local.py`, which prompts for the key
  and writes it to `.env` / `.env.local` (both git-ignored, never committed)

## Historical note
An earlier V19 build variant embedded the key directly in source for a
project-owner-requested package. That variant is not part of this repository.
If you ever find a real `gsk_...` key in a file, rotate it immediately and
remove it from git history before pushing.
