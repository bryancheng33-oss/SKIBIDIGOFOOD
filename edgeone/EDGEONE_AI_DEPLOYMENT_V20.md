# Skibidi GoFood AI on EdgeOne Pages - V20

## What was wrong before

The V19 package had working serverless files for Vercel and Netlify, but EdgeOne Pages does not automatically run those platform-specific files.

V20 adds an EdgeOne Pages Functions endpoint at:

```text
functions/api/sgf-ai.js
```

EdgeOne should map that function to:

```text
/api/sgf-ai
```

The website frontend already calls this same route, so no page-level change is needed.

## Deploy method that should work

Use EdgeOne Pages with Functions support. Do not deploy only as a static-only drop if you want real AI.

Recommended flow:

```bash
npm install -g edgeone
edgeone pages link
edgeone pages dev
```

Then deploy the project through EdgeOne Pages / repository deployment.

## Quick test after deployment

Open this URL in your browser:

```text
https://YOUR_EDGEONE_DOMAIN/api/sgf-ai
```

Expected JSON:

```json
{
  "ok": true,
  "service": "Skibidi GoFood AI",
  "runtime": "EdgeOne Pages Functions",
  "endpoint": "/api/sgf-ai",
  "method": "POST for chat requests"
}
```

Then open the website AI chat and ask:

```text
How do I use rewards?
```

If `/api/sgf-ai` shows 404, 405, static JavaScript code, or downloads a file, the project was deployed as static-only and the EdgeOne Function was not activated.

## Files added for EdgeOne

- `functions/api/sgf-ai.js`
- `edge-functions/api/sgf-ai.js`
- `cloud-functions/api/sgf-ai.js`
- `edgeone.json`

## Notes

The package also still includes Vercel and Netlify support, so it can run on those platforms too.
