#!/usr/bin/env bash
# GitHub Release helper — token is read from .zscripts/gh-token (gitignored, never committed)
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="pvwvuow/stag"
TOKEN_FILE=".zscripts/gh-token"
API="https://api.github.com"
UP="https://uploads.github.com"

H() { printf 'Authorization: token %s' "$(cat "$TOKEN_FILE")"; }

case "${1:-check}" in
  check)
    curl -s -H "$(H)" "$API/repos/$REPO/releases" -o .zscripts/releases.json
    python3 -c "
import json
rs = json.load(open('.zscripts/releases.json'))
print('existing releases:', len(rs))
for r in rs:
    print(' -', r['tag_name'], r.get('html_url'))
"
    ;;
  create)
    VER="${2:-1.2.0}"
    python3 -c "
import json
notes = open('.zscripts/release-notes.md', encoding='utf-8').read()
payload = {
    'tag_name': 'v$VER',
    'target_commitish': 'main',
    'name': 'STAG v$VER',
    'body': notes,
    'draft': False,
    'prerelease': False,
}
json.dump(payload, open('.zscripts/release-payload.json', 'w', encoding='utf-8'))
"
    code=$(curl -s -o .zscripts/release.json -w '%{http_code}' -X POST \
      -H "$(H)" -H 'Accept: application/vnd.github+json' \
      -d @.zscripts/release-payload.json "$API/repos/$REPO/releases")
    echo "create http: $code"
    python3 -c "
import json, sys
d = json.load(open('.zscripts/release.json'))
if 'id' in d:
    open('.zscripts/release-id', 'w').write(str(d['id']))
    print('created release id:', d['id'], '|', d['html_url'])
else:
    print('ERROR:', str(d)[:400])
    sys.exit(1)
"
    ;;
  upload)
    f="$2"; name="$3"
    id=$(cat .zscripts/release-id)
    code=$(curl -s -o .zscripts/up.json -w '%{http_code}' -X POST \
      -H "$(H)" -H 'Content-Type: application/octet-stream' \
      --data-binary "@$f" "$UP/repos/$REPO/releases/$id/assets?name=$name")
    echo "upload http: $code"
    python3 -c "
import json, sys
d = json.load(open('.zscripts/up.json'))
state = d.get('state')
print(sys.argv[1], '->', state, '| size:', d.get('size'))
if state != 'uploaded':
    print('ERROR:', str(d)[:400]); sys.exit(1)
" "$name"
    ;;
  verify)
    id=$(cat .zscripts/release-id)
    curl -s -H "$(H)" "$API/repos/$REPO/releases/$id" -o .zscripts/final.json
    python3 -c "
import json
d = json.load(open('.zscripts/final.json'))
print('URL:', d['html_url'])
print('tag:', d['tag_name'], '| draft:', d['draft'], '| prerelease:', d['prerelease'])
for a in d['assets']:
    print('asset:', a['name'], '|', round(a['size']/1024/1024, 1), 'MB |', a['state'])
    print('  ', a['browser_download_url'])
"
    ;;
  *)
    echo "usage: $0 {check|create|upload <file> <name>|verify}"
    exit 1
    ;;
esac
