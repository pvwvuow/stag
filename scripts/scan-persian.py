#!/usr/bin/env python3
"""Scan user-visible Persian string literals left in src (excluding i18n dict,
games/dns-catalog data files, comments)."""
import re, pathlib, sys

FA = re.compile(r'[\u0600-\u06FF]')
FILES = [
    'src/components/app-shell.tsx', 'src/components/titlebar.tsx',
    'src/components/stag-store.tsx', 'src/components/ping-chart.tsx',
    'src/components/ui-helpers.tsx', 'src/components/brand.tsx',
    'src/components/views/dashboard.tsx', 'src/components/views/optimize.tsx',
    'src/components/views/servers.tsx', 'src/components/views/settings.tsx',
    'src/components/views/about.tsx', 'src/components/error-boundary.tsx',
    'src/app/page.tsx', 'src/app/layout.tsx',
]
ALLOW = re.compile(r'^[\s/*\d.]+$')

left = []
for f in FILES:
    p = pathlib.Path(f)
    if not p.exists():
        continue
    for i, line in enumerate(p.read_text(encoding='utf8').splitlines(), 1):
        stripped = line.strip()
        # skip pure comments
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            continue
        # find double-quoted literals containing Persian
        for m in re.finditer(r'"([^"\\]*(?:\\.[^"\\]*)*)"', line):
            lit = m.group(1)
            if FA.search(lit):
                left.append((f, i, stripped[:110]))
                break

for f, i, l in left:
    print(f'{f}:{i}: {l}')
print(f'\nTOTAL: {len(left)}')
sys.exit(0)
