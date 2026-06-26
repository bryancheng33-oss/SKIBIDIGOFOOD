#!/usr/bin/env python3
"""Create local Groq environment files without embedding secrets.

Run from the project root:
  python scripts/create-groq-env-local.py

Paste the key only into the terminal prompt. The key is written to .env.local and .env,
which are ignored by git. Do not commit real keys.
"""
from getpass import getpass
from pathlib import Path

root = Path.cwd()
DEFAULT_MODEL = "llama-3.3-70b-versatile"

key = getpass("Groq API key (hidden input): ").strip()
if not key:
    raise SystemExit("No key entered. Nothing written.")
model = input(f"Groq model [{DEFAULT_MODEL}]: ").strip() or DEFAULT_MODEL
content = f"GROQ_API_KEY={key}\nGROQ_MODEL={model}\n"

for name in [".env.local", ".env"]:
    path = root / name
    path.write_text(content, encoding="utf-8")
    print(f"Wrote {name}")

print("Done. Keep .env.local and .env private; never commit them.")
