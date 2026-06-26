#!/usr/bin/env python3
"""Skibidi GoFood V16 static/live audit.
Runs local checks without external dependencies. If --base-url is provided, also checks live headers/routes.
"""
from __future__ import annotations
import argparse, json, re, sys, urllib.request, urllib.error
from pathlib import Path
from html.parser import HTMLParser

VERSION = '20260526v16'

class RefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.metas = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('href','src','action'):
            if key in attrs:
                self.refs.append((tag, key, attrs[key]))
        if tag == 'meta':
            self.metas.append(attrs)

def local_asset_audit(root: Path):
    failures = []
    html_files = sorted(root.glob('*.html'))
    for page in html_files:
        parser = RefParser()
        parser.feed(page.read_text(encoding='utf-8', errors='ignore'))
        text = page.read_text(encoding='utf-8', errors='ignore')
        for required in ['css/operational-completion-v16.css', 'js/operational-completion-v16.js', VERSION]:
            if required not in text:
                failures.append(f'{page.name}: missing {required}')
        for tag, key, raw in parser.refs:
            if not raw or raw.startswith(('#','mailto:','tel:','javascript:','data:')):
                continue
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', raw):
                continue
            clean = raw.split('#',1)[0].split('?',1)[0]
            if not clean or clean.startswith('/'):
                continue
            candidate = (page.parent / clean).resolve()
            if not str(candidate).startswith(str(root.resolve())):
                failures.append(f'{page.name}: unsafe local path {raw}')
            elif not candidate.exists():
                # Extensionless clean URLs are allowed when the .html equivalent exists.
                html_equiv = candidate.with_suffix('.html') if candidate.suffix == '' else None
                if not (html_equiv and html_equiv.exists()):
                    failures.append(f'{page.name}: missing local asset/link {raw}')
    return failures

def config_audit(root: Path):
    failures = []
    for name in ['_headers','vercel.json','.htaccess','site-version.json','css/operational-completion-v16.css','js/operational-completion-v16.js']:
        if not (root/name).exists():
            failures.append(f'missing {name}')
    site = json.loads((root/'site-version.json').read_text(encoding='utf-8'))
    if site.get('version') != VERSION:
        failures.append('site-version.json does not match V16')
    headers = (root/'_headers').read_text(encoding='utf-8', errors='ignore')
    for token in ['Strict-Transport-Security','Content-Security-Policy','X-Frame-Options','X-Content-Type-Options','Referrer-Policy','Permissions-Policy','X-Permitted-Cross-Domain-Policies']:
        if token not in headers:
            failures.append(f'_headers missing {token}')
    vercel = json.loads((root/'vercel.json').read_text(encoding='utf-8'))
    if not isinstance(vercel.get('headers'), list):
        failures.append('vercel.json headers missing')
    ht = (root/'.htaccess').read_text(encoding='utf-8', errors='ignore')
    if 'RewriteRule ^ https://' not in ht:
        failures.append('.htaccess missing HTTPS redirect')
    state = (root/'js/state.js').read_text(encoding='utf-8', errors='ignore')
    if "password: 'admin123'" in state or 'password: "admin123"' in state:
        failures.append('plaintext admin demo password still present')
    if 'passwordHash' not in state or 'sgfVerifyPassword(cleanPassword' not in state:
        failures.append('admin credential hash verification not found')
    admin = (root/'js/admin-login.js').read_text(encoding='utf-8', errors='ignore')
    for token in ['MAX_ADMIN_ATTEMPTS','ADMIN_LOCK_MS','recordFailedAttempt','clearLockState']:
        if token not in admin:
            failures.append(f'admin lockout missing {token}')
    return failures

def js_syntax_audit(root: Path):
    import subprocess, shutil
    if shutil.which('node') is None:
        return []
    failures = []
    for path in sorted(root.rglob('*.js')):
        if '.github' in path.parts:
            continue
        proc = subprocess.run(['node','--check',str(path)], capture_output=True, text=True)
        if proc.returncode != 0:
            failures.append(f'JS syntax failed: {path.relative_to(root)}: {proc.stderr.strip()}')
    return failures

def live_audit(base_url: str):
    failures = []
    base = base_url.rstrip('/')
    routes = ['/', '/orders', '/site-version.json']
    for route in routes:
        url = base + route
        try:
            req = urllib.request.Request(url, headers={'User-Agent':'SGF-V16-Audit/1.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                headers = {k.lower(): v for k,v in resp.headers.items()}
                body = resp.read(1000).decode('utf-8', errors='ignore')
            if route == '/site-version.json' and VERSION not in body:
                failures.append(f'{url}: site version is not V16')
            if route in ['/', '/orders']:
                for h in ['strict-transport-security','content-security-policy','x-content-type-options','referrer-policy']:
                    if h not in headers:
                        failures.append(f'{url}: missing live header {h}')
        except Exception as exc:
            failures.append(f'{url}: {exc}')
    return failures

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', default='.', help='project root')
    ap.add_argument('--base-url', default='', help='optional deployed URL for live checks')
    args = ap.parse_args()
    root = Path(args.root).resolve()
    failures = []
    for fn in (local_asset_audit, config_audit, js_syntax_audit):
        failures.extend(fn(root))
    if args.base_url:
        failures.extend(live_audit(args.base_url))
    report = {'version': VERSION, 'root': str(root), 'live_url_checked': bool(args.base_url), 'passed': not failures, 'failures': failures}
    print(json.dumps(report, indent=2))
    return 1 if failures else 0

if __name__ == '__main__':
    raise SystemExit(main())
