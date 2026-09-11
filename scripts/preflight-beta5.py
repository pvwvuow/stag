#!/usr/bin/env python3
"""beta.5 pre-release checks:
1. sha512(latest.yml) == actual Setup.exe
2. packaged main.cjs (from app.asar) passes the TDZ order test
3. SHA256SUMS.txt regeneration
"""
import hashlib, base64, re, subprocess, sys, os, json, gzip

os.chdir("/home/z/my-project")
ok = True

def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return h.hexdigest()

def sha512_b64(p):
    h = hashlib.sha512()
    with open(p, 'rb') as f:
        for c in iter(lambda: f.read(1 << 20), b''):
            h.update(c)
    return base64.b64encode(h.digest()).decode()

# 1) latest.yml sha512
yml = open('release/latest.yml', encoding='utf8').read()
declared = re.search(r'sha512: ([A-Za-z0-9+/=]+)', yml).group(1)
actual = sha512_b64('release/STAG-Beta-Setup-1.4.0-beta.5.exe')
m = declared == actual
ok &= m
print(('OK  ' if m else 'FAIL'), 'sha512 latest.yml == Setup.exe')

# 2) packaged main.cjs TDZ
r = subprocess.run(['npx', 'asar', 'extract-file',
                    'release/win-unpacked/resources/app.asar', 'electron/main.cjs'],
                   capture_output=True, text=True)
# asar extract-file writes to cwd as main.cjs? use electron/asar API fallback
if not os.path.exists('main.cjs'):
    r2 = subprocess.run(['node', '-e', '''
const asar = require("@electron/asar");
const fs = require("fs");
const buf = asar.extractFile("release/win-unpacked/resources/app.asar", "main.cjs");
fs.writeFileSync("/tmp/stag-packaged-main.cjs", buf);
console.log("extracted", buf.length, "bytes");
'''], capture_output=True, text=True, cwd='/home/z/my-project')
    if r2.returncode != 0:
        print('FAIL extract packaged main.cjs:', r2.stderr[:300]); ok = False
    src = '/tmp/stag-packaged-main.cjs'
else:
    src = 'main.cjs'
if os.path.exists(src) or src != 'main.cjs':
    r3 = subprocess.run(['node', 'scripts/test-main-order.mjs', src],
                        capture_output=True, text=True)
    m = r3.returncode == 0 and 'PASS' in r3.stdout
    ok &= m
    print(('OK  ' if m else 'FAIL'), 'packaged main.cjs TDZ:', r3.stdout.strip().splitlines()[-1] if r3.stdout else r3.stderr[:200])

# 3) SHA256SUMS.txt
files = [
    'STAG-Beta-Setup-1.4.0-beta.5.exe',
    'STAG-Beta-Setup-1.4.0-beta.5.exe.blockmap',
    'STAG-Beta-Portable-1.4.0-beta.5.exe',
    'latest.yml',
]
lines = []
for name in files:
    p = f'release/{name}'
    if not os.path.exists(p):
        print('MISSING', name); ok = False; continue
    lines.append(f'{sha256(p)}  {name}')
open('release/SHA256SUMS.txt', 'w').write('\n'.join(lines) + '\n')
print('OK   SHA256SUMS.txt written')
for l in lines:
    print('  ', l)

# 4) blockmap sanity (gzip json)
try:
    raw = open('release/STAG-Beta-Setup-1.4.0-beta.5.exe.blockmap', 'rb').read()
    try:
        bm = json.loads(gzip.decompress(raw))
    except gzip.BadGzipFile:
        bm = json.loads(raw)
    print('OK   blockmap version', bm.get('version'))
except Exception as e:
    print('FAIL blockmap:', e); ok = False

print('PACK-PREFLIGHT-GREEN' if ok else 'PACK-PREFLIGHT-FAILED')
sys.exit(0 if ok else 1)
