#!/usr/bin/env bash
# Release v1.4.0-beta.7 — create release, upload 5 assets, verify digests.
# Protocol: token is read from .zscripts/gh-token and NEVER echoed.
# NOTE: target_commitish MUST be the FULL 40-char SHA (GitHub API rejects
# short SHAs since ~2025: "tag_name is not a valid tag").
set -euo pipefail
REPO="pvwvuow/stag"
TAG="v1.4.0-beta.7"
TARGET="9276d38f1cff844b418144b0e14b9509a57b30e3"
VERSION="1.4.0-beta.7"
TOKEN=$(cat .zscripts/gh-token)
AUTH="Authorization: Bearer $TOKEN"
API="https://api.github.com"
UP="https://uploads.github.com"

cmd="${1:-all}"

notes_json=$(python3 - <<'PY'
import json
body = open('.zscripts/release-notes-b7.md', encoding='utf8').read()
print(json.dumps({
    "tag_name": "v1.4.0-beta.7",
    "target_commitish": "9276d38f1cff844b418144b0e14b9509a57b30e3",
    "name": "STAG Beta 1.4.0-beta.7 — پینگ صادقانه DNS + آشکارساز رهگیری ISP",
    "body": body,
    "prerelease": True,
    "draft": False,
}, ensure_ascii=False))
PY
)

create_release() {
  local out id
  out=$(curl -sS -X POST -H "$AUTH" -H "Accept: application/vnd.github+json" \
    -d "$notes_json" "$API/repos/$REPO/releases")
  id=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" <<<"$out")
  if [ -z "$id" ]; then echo "CREATE FAILED:"; echo "$out" | head -8; exit 1; fi
  echo "$id" > .zscripts/release-id-b7
  echo "release created id=$id"
}

upload() {
  local file="$1" name="$2" ctype="$3" id out
  id=$(cat .zscripts/release-id-b7)
  out=$(curl -sS -X POST -H "$AUTH" -H "Content-Type: $ctype" \
    --data-binary "@$file" "$UP/repos/$REPO/releases/$id/assets?name=$name")
  python3 -c "import json,sys; d=json.load(sys.stdin); print('uploaded:', d.get('name'), d.get('size'), d.get('state', d.get('message','')))" <<<"$out"
}

verify() {
  python3 - <<'PY'
import hashlib, json, subprocess, os
TOKEN = open('.zscripts/gh-token').read().strip()
REPO = "pvwvuow/stag"
TAG = "v1.4.0-beta.7"
def gh(url):
    return subprocess.run(["curl","-sS","-H",f"Authorization: Bearer {TOKEN}",url],
                          capture_output=True, text=True).stdout
rel = json.loads(gh(f"https://api.github.com/repos/{REPO}/releases/tags/{TAG}"))
assert rel.get("tag_name") == TAG, f"release fetch failed: {rel.get('message')}"
print("release id", rel["id"], "| target:", rel["target_commitish"][:12], "| prerelease:", rel["prerelease"])
remote = {a["name"]: a for a in rel["assets"]}
V = "1.4.0-beta.7"
files = {
 f"STAG-Beta-Setup-{V}.exe": f"release/STAG-Beta-Setup-{V}.exe",
 f"STAG-Beta-Setup-{V}.exe.blockmap": f"release/STAG-Beta-Setup-{V}.exe.blockmap",
 f"STAG-Beta-Portable-{V}.exe": f"release/STAG-Beta-Portable-{V}.exe",
 "latest.yml": "release/latest.yml",
 "SHA256SUMS.txt": "release/SHA256SUMS.txt",
}
ok = True
for name, path in files.items():
    a = remote.get(name)
    if not a:
        print("MISSING asset:", name); ok = False; continue
    h = hashlib.sha256()
    with open(path,'rb') as f:
        for c in iter(lambda: f.read(1<<20), b''): h.update(c)
    local = "sha256:" + h.hexdigest()
    match = (a.get("digest") == local) and (a["size"] == os.path.getsize(path))
    print(("OK  " if match else "FAIL"), name, a["size"])
    ok = ok and match
print("ALL-GREEN" if ok else "VERIFICATION FAILED")
exit(0 if ok else 1)
PY
}

case "$cmd" in
  create) create_release ;;
  upload) upload "release/STAG-Beta-Setup-$VERSION.exe" "STAG-Beta-Setup-$VERSION.exe" application/octet-stream
          upload "release/STAG-Beta-Setup-$VERSION.exe.blockmap" "STAG-Beta-Setup-$VERSION.exe.blockmap" application/octet-stream
          upload "release/STAG-Beta-Portable-$VERSION.exe" "STAG-Beta-Portable-$VERSION.exe" application/octet-stream
          upload release/latest.yml latest.yml text/yaml
          upload release/SHA256SUMS.txt SHA256SUMS.txt text/plain ;;
  verify) verify ;;
  all) create_release
       upload "release/STAG-Beta-Setup-$VERSION.exe" "STAG-Beta-Setup-$VERSION.exe" application/octet-stream
       upload "release/STAG-Beta-Setup-$VERSION.exe.blockmap" "STAG-Beta-Setup-$VERSION.exe.blockmap" application/octet-stream
       upload "release/STAG-Beta-Portable-$VERSION.exe" "STAG-Beta-Portable-$VERSION.exe" application/octet-stream
       upload release/latest.yml latest.yml text/yaml
       upload release/SHA256SUMS.txt SHA256SUMS.txt text/plain
       verify ;;
esac
