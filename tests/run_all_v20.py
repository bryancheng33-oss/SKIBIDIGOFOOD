#!/usr/bin/env python3
import argparse, json, subprocess, sys
from pathlib import Path

VERSION = '20260526v20'

parser = argparse.ArgumentParser()
parser.add_argument('--root', default='.')
args = parser.parse_args()
root = Path(args.root).resolve()
failures = []
checks = {}

def check(cond, msg):
    checks[msg] = bool(cond)
    if not cond:
        failures.append(msg)

# Version checks
site_version = root / 'site-version.json'
try:
    data = json.loads(site_version.read_text(encoding='utf-8'))
    check(data.get('version') == VERSION, 'site-version.json uses V20')
except Exception as exc:
    failures.append(f'site-version.json invalid: {exc}')

for html in sorted(root.glob('*.html')):
    text = html.read_text(encoding='utf-8', errors='ignore')
    check(VERSION in text, f'{html.name} contains V20 cache-busting')

# EdgeOne files
for rel in ['functions/api/sgf-ai.js', 'edge-functions/api/sgf-ai.js', 'cloud-functions/api/sgf-ai.js', 'edgeone.json']:
    check((root / rel).exists(), f'{rel} exists')

# JSON config
try:
    json.loads((root / 'edgeone.json').read_text(encoding='utf-8'))
    check(True, 'edgeone.json is valid JSON')
except Exception as exc:
    failures.append(f'edgeone.json invalid: {exc}')

# Frontend endpoint
frontend = root / 'js/student-ai-chat.js'
front_text = frontend.read_text(encoding='utf-8', errors='ignore') if frontend.exists() else ''
check("/api/sgf-ai" in front_text, 'frontend calls /api/sgf-ai')

# Syntax checks
for rel in ['functions/api/sgf-ai.js', 'edge-functions/api/sgf-ai.js', 'cloud-functions/api/sgf-ai.js']:
    p = root / rel
    try:
        subprocess.run(['node', '--input-type=module', '--check'], input=p.read_text(encoding='utf-8'), text=True, check=True, capture_output=True)
        check(True, f'{rel} module syntax ok')
    except Exception as exc:
        failures.append(f'{rel} module syntax failed: {exc}')

for rel in ['api/sgf-ai.js', 'netlify/functions/sgf-ai.js']:
    p = root / rel
    if p.exists():
        try:
            subprocess.run(['node', '--check', str(p)], check=True, capture_output=True, text=True)
            check(True, f'{rel} node syntax ok')
        except Exception as exc:
            failures.append(f'{rel} node syntax failed: {exc}')

# Confirm key is not embedded in common browser-facing HTML/CSS/runtime JS bundles.
# Direct-key source files are intentionally allowed in serverless/source scripts for this requested V19/V20 direct build.
public_key_hits = []
for pattern in ['*.html', 'css/*.css', 'js/*.js', 'assets/*.js', 'assets/*.css']:
    for p in root.glob(pattern):
        if 'gsk_' in p.read_text(encoding='utf-8', errors='ignore'):
            public_key_hits.append(str(p.relative_to(root)))
check(not public_key_hits, 'no Groq key in browser-facing HTML/CSS/frontend JS')
if public_key_hits:
    failures.append('Groq key found in browser-facing files: ' + ', '.join(public_key_hits))

result = {
    'version': VERSION,
    'root': str(root),
    'passed': not failures,
    'failures': failures,
    'checks': checks,
    'note': 'This validates package-level EdgeOne compatibility. Live EdgeOne deployment still must enable Pages Functions.'
}
print(json.dumps(result, indent=2))
sys.exit(1 if failures else 0)
