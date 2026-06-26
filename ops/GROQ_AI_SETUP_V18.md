# V18 Groq AI Setup — API Key Hidden From Browser

## Important
The Groq key must **never** be placed in HTML, CSS, frontend JavaScript, localStorage, sessionStorage, or a public JSON file.

Because a key was pasted during development discussion, create a new Groq key and revoke the old one before production use.

## Vercel
1. Open project settings.
2. Add Environment Variable: `GROQ_API_KEY`.
3. Optional: add `GROQ_MODEL`, for example `llama-3.3-70b-versatile`.
4. Redeploy.
5. The browser calls `/api/sgf-ai`; the function calls Groq server-side.

## Netlify
1. Add Environment Variable: `GROQ_API_KEY`.
2. Optional: add `GROQ_MODEL`.
3. Deploy with Netlify Functions enabled.
4. `_redirects` maps `/api/sgf-ai` to `/.netlify/functions/sgf-ai`.

## Local testing
For Vercel CLI or Netlify CLI, create a local `.env` file from `.env.example` and add the key there. `.env` is ignored by Git.

## Verification
Run:

```bash
python tests/run_all_v18.py --root .
```

The audit fails if a `gsk_`-style Groq secret is found in project files.
