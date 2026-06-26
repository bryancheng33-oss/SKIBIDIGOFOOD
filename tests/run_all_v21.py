#!/usr/bin/env python3
"""Skibidi GoFood V21 secure mastery audit.
Checks static assets, metadata, security headers, AI secret hygiene, and function syntax.
"""
from __future__ import annotations
import argparse, json, re, subprocess, sys
from html.parser import HTMLParser
from pathlib import Path

VERSION = '20260526v21'
SECRET_PATTERNS = [
    re.compile(r'gsk_[A-Za-z0-9_\-]{20,}'),
    re.compile('DIRECT_' + 'GROQ_API_KEY'),
]

class RefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs=[]; self.tags=[]; self.h1=0; self.images=[]; self.title=''; self.meta=[]; self.links=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs); self.tags.append((tag,attrs))
        for key in ('href','src','action'):
            if key in attrs: self.refs.append((tag,key,attrs[key]))
        if tag=='meta': self.meta.append(attrs)
        if tag=='link': self.links.append(attrs)
        if tag=='img': self.images.append(attrs)
        if tag=='h1': self.h1 += 1
    def handle_data(self, data):
        pass

def parse_html(path: Path):
    parser=RefParser(); parser.feed(path.read_text(encoding='utf-8', errors='ignore')); return parser

def local_asset_audit(root: Path):
    failures=[]
    for page in sorted(root.glob('*.html')):
        parser=parse_html(page)
        text=page.read_text(encoding='utf-8', errors='ignore')
        if VERSION not in text:
            failures.append(f'{page.name}: missing {VERSION} cache-busting/build marker')
        if '<title>' not in text or '</title>' not in text:
            failures.append(f'{page.name}: missing title')
        if not any(m.get('name')=='description' and m.get('content') for m in parser.meta):
            failures.append(f'{page.name}: missing meta description')
        if parser.h1 != 1:
            failures.append(f'{page.name}: expected exactly one h1, found {parser.h1}')
        if not any(l.get('rel')=='canonical' or (isinstance(l.get('rel'), str) and 'canonical' in l.get('rel')) for l in parser.links):
            failures.append(f'{page.name}: missing canonical link')
        if not any(l.get('rel')=='manifest' or (isinstance(l.get('rel'), str) and 'manifest' in l.get('rel')) for l in parser.links):
            failures.append(f'{page.name}: missing manifest link')
        for img in parser.images:
            if 'alt' not in img:
                failures.append(f'{page.name}: image missing alt: {img.get("src","")}')
        for tag,key,raw in parser.refs:
            if not raw or raw.startswith(('#','mailto:','tel:','javascript:','data:')):
                continue
            if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', raw):
                continue
            clean=raw.split('#',1)[0].split('?',1)[0]
            if not clean or clean.startswith('/'):
                continue
            candidate=(page.parent/clean).resolve()
            if not str(candidate).startswith(str(root.resolve())):
                failures.append(f'{page.name}: unsafe local path {raw}')
            elif not candidate.exists():
                html_equiv=candidate.with_suffix('.html') if candidate.suffix=='' else None
                if not (html_equiv and html_equiv.exists()):
                    failures.append(f'{page.name}: missing local asset/link {raw}')
    for rel in ['robots.txt','sitemap.xml','manifest.webmanifest']:
        if not (root/rel).exists(): failures.append(f'missing {rel}')
    return failures

def config_audit(root: Path):
    failures=[]
    for rel in ['_headers','vercel.json','edgeone.json','.htaccess','site-version.json','.env.example','api/sgf-ai.js','netlify/functions/sgf-ai.js','functions/api/sgf-ai.js']:
        if not (root/rel).exists(): failures.append(f'missing {rel}')
    try:
        data=json.loads((root/'site-version.json').read_text(encoding='utf-8'))
        if data.get('version') != VERSION: failures.append('site-version.json version mismatch')
    except Exception as exc:
        failures.append(f'site-version.json invalid: {exc}')
    headers=(root/'_headers').read_text(encoding='utf-8', errors='ignore')
    for token in ['Strict-Transport-Security','Content-Security-Policy','X-Frame-Options','X-Content-Type-Options','Referrer-Policy','Permissions-Policy','Cross-Origin-Opener-Policy','Cross-Origin-Resource-Policy']:
        if token not in headers: failures.append(f'_headers missing {token}')
    if "connect-src 'self' https://*.supabase.co wss://*.supabase.co" not in headers:
        failures.append('_headers CSP connect-src does not allow Supabase')
    try:
        vercel=json.loads((root/'vercel.json').read_text(encoding='utf-8'))
        if not isinstance(vercel.get('headers'), list): failures.append('vercel.json headers missing')
    except Exception as exc:
        failures.append(f'vercel.json invalid: {exc}')
    try:
        edge=json.loads((root/'edgeone.json').read_text(encoding='utf-8'))
        dumped=json.dumps(edge)
        for token in ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options']:
            if token not in dumped: failures.append(f'edgeone.json missing {token}')
    except Exception as exc:
        failures.append(f'edgeone.json invalid: {exc}')
    robots=(root/'robots.txt').read_text(encoding='utf-8', errors='ignore')
    for private in ['/admin','/admin-login','/dashboard','/cart','/checkout','/orders','/profile']:
        if f'Disallow: {private}' not in robots: failures.append(f'robots.txt missing private disallow {private}')
    sitemap=(root/'sitemap.xml').read_text(encoding='utf-8', errors='ignore')
    for private in ['/admin','/cart','/checkout','/orders','/profile']:
        if private in sitemap: failures.append(f'sitemap includes private route {private}')
    return failures

def secret_scan_audit(root: Path):
    failures=[]
    skip_dirs={'.git','node_modules'}
    skip_ext={'.png','.jpg','.jpeg','.webp','.ico','.zip'}
    for path in root.rglob('*'):
        if not path.is_file() or any(part in skip_dirs for part in path.parts) or path.suffix.lower() in skip_ext:
            continue
        text=path.read_text(encoding='utf-8', errors='ignore')
        for pat in SECRET_PATTERNS:
            if pat.search(text):
                failures.append(f'possible embedded AI secret or direct-key fallback in {path.relative_to(root)}')
                break
    return failures

def ai_proxy_audit(root: Path):
    failures=[]
    required_env='GROQ_API_KEY'
    for rel in ['api/sgf-ai.js','netlify/functions/sgf-ai.js','functions/api/sgf-ai.js','edge-functions/api/sgf-ai.js','cloud-functions/api/sgf-ai.js']:
        text=(root/rel).read_text(encoding='utf-8', errors='ignore')
        if required_env not in text: failures.append(f'{rel}: missing GROQ_API_KEY env lookup')
        if 'Set GROQ_API_KEY' not in text: failures.append(f'{rel}: missing clear configuration error')
        if 'api.groq.com/openai/v1/chat/completions' not in text: failures.append(f'{rel}: missing Groq endpoint')
        if 'rateLimited' not in text: failures.append(f'{rel}: missing rate limiter')
    return failures

def syntax_audit(root: Path):
    failures=[]
    for rel in ['api/sgf-ai.js','netlify/functions/sgf-ai.js']:
        proc=subprocess.run(['node','--check',str(root/rel)],capture_output=True,text=True)
        if proc.returncode: failures.append(f'{rel} syntax failed: {proc.stderr.strip()}')
    for rel in ['functions/api/sgf-ai.js','edge-functions/api/sgf-ai.js','cloud-functions/api/sgf-ai.js']:
        text=(root/rel).read_text(encoding='utf-8')
        proc=subprocess.run(['node','--input-type=module','--check'],input=text,capture_output=True,text=True)
        if proc.returncode: failures.append(f'{rel} module syntax failed: {proc.stderr.strip()}')
    return failures

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--root',default='.')
    args=ap.parse_args(); root=Path(args.root).resolve()
    failures=[]
    checks={}
    for name,fn in [('local_assets',local_asset_audit),('config',config_audit),('secrets',secret_scan_audit),('ai_proxy',ai_proxy_audit),('syntax',syntax_audit)]:
        result=fn(root); checks[name]=not result; failures.extend(result)
    report={'version':VERSION,'root':str(root),'passed':not failures,'failures':failures,'checks':checks,'note':'V21 validates secure environment-only AI configuration plus SEO/accessibility/static package quality.'}
    print(json.dumps(report,indent=2))
    return 1 if failures else 0

if __name__=='__main__':
    raise SystemExit(main())
