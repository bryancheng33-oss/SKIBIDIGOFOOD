# EdgeOne AI Troubleshooting

## Symptom: AI only gives local/fallback answers

Check the API route:

```text
https://YOUR_DOMAIN/api/sgf-ai
```

Expected: JSON with `ok: true`.

If not working:

1. Confirm `functions/api/sgf-ai.js` exists in the project root.
2. Confirm the deployment used EdgeOne Pages Functions, not only static hosting.
3. Open browser DevTools > Network > send an AI message > click `/api/sgf-ai`.
4. Check status:
   - 404: function route not deployed.
   - 405: GET/POST method mismatch; use GET health check or POST from chat.
   - 502: Groq provider request failed.
   - 500: function crashed; check EdgeOne function logs.
5. Purge EdgeOne cache and redeploy.

## Expected EdgeOne route

`functions/api/sgf-ai.js` should become `/api/sgf-ai`.

## Browser test command

```js
fetch('/api/sgf-ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'How do I use rewards?', context: {}, localFallback: 'Rewards are on the Rewards page.' })
}).then(r => r.json()).then(console.log)
```
