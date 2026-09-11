#!/usr/bin/env python3
"""Pre-release checks (generic — pass version as argv[1]):
1. sha512(latest.yml) == actual Setup.exe + version consistency
2. packaged main.cjs (from app.asar) passes the TDZ order test
3. SHA256SUMS.txt regeneration
4. blockmap sanity (gzip json)
Usage: python3 scripts/preflight-release.py 1.4.0-beta.6
"""
import hashlib, base64, re, subprocess, sys, os, json, gzip

VERSION = sys.argv[1] if len(sys.argv) > 1 else "1.4.0-beta.6"
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

# 0) version consistency
pkg = json.load(open('package.json'))['version']
m = pkg == VERSION
ok &= m
print(('OK  ' if m else 'FAIL'), f'package.json version == {VERSION}')

# 1) latest.yml sha512 + version
yml = open('release/latest.yml', encoding='utf8').read()
declared = re.search(r'sha512: ([A-Za-z0-9+/=]+)', yml).group(1)
actual = sha512_b64(f'release/STAG-Beta-Setup-{VERSION}.exe')
m = declared == actual
ok &= m
print(('OK  ' if m else 'FAIL'), 'sha512 latest.yml == Setup.exe')
m = f'version: {VERSION}' in yml
ok &= m
print(('OK  ' if m else 'FAIL'), f'latest.yml version == {VERSION}')

# 2) packaged main.cjs TDZ
subprocess.run(['node', '-e', '''
const asar = require("@electron/asar");
const fs = require("fs");
const buf = asar.extractFile("release/win-unpacked/resources/app.asar", "electron/main.cjs");
fs.writeFileSync("/tmp/stag-packaged-main.cjs", buf);
console.log("extracted", buf.length, "bytes");
'''], capture_output=True, text=True, cwd='/home/z/my-project')
r3 = subprocess.run(['node', 'scripts/test-main-order.mjs', '/tmp/stag-packaged-main.cjs'],
                    capture_output=True, text=True)
m = r3.returncode == 0 and 'PASS' in r3.stdout
ok &= m
print(('OK  ' if m else 'FAIL'), 'packaged main.cjs TDZ:', r3.stdout.strip().splitlines()[-1] if r3.stdout else r3.stderr[:200])

# 3) SHA256SUMS.txt
files = [
    f'STAG-Beta-Setup-{VERSION}.exe',
    f'STAG-Beta-Setup-{VERSION}.exe.blockmap',
    f'STAG-Beta-Portable-{VERSION}.exe',
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
    raw = open(f'release/STAG-Beta-Setup-{VERSION}.exe.blockmap', 'rb').read()
    try:
        bm = json.loads(gzip.decompress(raw))
    except gzip.BadGzipFile:
        bm = json.loads(raw)
    print('OK   blockmap version', bm.get('version'))
except Exception as e:
    print('FAIL blockmap:', e); ok = False

print('PACK-PREFLIGHT-GREEN' if ok else 'PACK-PREFLIGHT-FAILED')
sys.exit(0 if ok else 1)
