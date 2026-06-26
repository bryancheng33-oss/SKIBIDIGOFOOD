# Groq AI key setup for Skibidi GoFood V18

The Groq API key is intentionally not hardcoded in any frontend file, HTML file, or downloadable public source file. A key placed inside client-side JavaScript, HTML, localStorage, or a public ZIP can be inspected and copied.

## Local demo setup

Run this from the project root:

```bash
python scripts/create-groq-env-local.py
```

Paste the key when prompted. The script writes `.env.local` and `.env`, which are ignored by Git. Do not upload these files to public static hosting.

## Vercel setup

Set these environment variables in the Vercel dashboard or with the CLI:

```bash
vercel env add GROQ_API_KEY production
vercel env add GROQ_API_KEY preview
vercel env add GROQ_MODEL production
vercel env add GROQ_MODEL preview
```

## Netlify setup

Set these environment variables in the Netlify dashboard or with the CLI:

```bash
netlify env:set GROQ_API_KEY
netlify env:set GROQ_MODEL llama-3.3-70b-versatile
```

## Why there is no direct hardcoded key

The site requirement says the key must not be inspectable. Directly putting the key inside a frontend/static project conflicts with that requirement. V18 keeps the key server-side through `/api/sgf-ai` and the Netlify/Vercel function proxy.

## After the project

Rotate or revoke the key in the Groq dashboard, especially because the key was pasted into chat during development.
