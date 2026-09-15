#!/bin/sh
set -eu
BRANCH='dev/0.19.18-poll-warp-rescue'
URL="https://raw.githubusercontent.com/Medvedolog/podkop_bot/${BRANCH}/podkop_bot.sh"
DST='root/usr/lib/podkop_bot/podkop_bot'
TMP="${DST}.sync.$$"

curl -fL --retry 4 --retry-delay 2 "$URL" -o "$TMP"
chmod 0755 "$TMP"
sh -n "$TMP"
# r44 marker must be present; refuse to vendor an older standalone file.
grep -q '# r44-proxy-ui-sync' "$TMP"
mv "$TMP" "$DST"

sha256sum "$DST" | awk '{print $1 "  podkop_bot"}' > root/usr/lib/podkop_bot/vendor.sha256

# r42 was only a packaging-side stopgap. Once standalone carries the fix,
# packaging must not mutate either vendored or installed bot at postinst time.
rm -f root/usr/lib/podkop_bot/hotfix-proxy-ui-r42.sh
python3 - <<'PY'
from pathlib import Path
p=Path('scripts/postinst')
s=p.read_text()
s=s.replace('\n\t/usr/lib/podkop_bot/hotfix-proxy-ui-r42.sh \\\n','\n')
start='# Keep the bundled bot and an already installed /usr/bin copy in sync with the\n'
end='\n/etc/init.d/rpcd restart >/dev/null 2>&1 || true\n'
if start in s:
    a=s.index(start)
    b=s.index(end,a)
    s=s[:a]+s[b+1:]
p.write_text(s)

m=Path('Makefile')
ms=m.read_text().replace('PKG_RELEASE:=43','PKG_RELEASE:=44')
m.write_text(ms)
PY

grep -q 'PKG_RELEASE:=44' Makefile
! grep -q 'hotfix-proxy-ui-r42' scripts/postinst
