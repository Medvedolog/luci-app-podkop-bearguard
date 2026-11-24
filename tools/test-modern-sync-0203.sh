#!/bin/sh
# BearGuard 0.20.3: byte-for-byte vendoring and semver/dev-version regression.
set -eu
cd "$(dirname "$0")/.."
bot=root/usr/lib/podkop_bot/podkop_bot
base=root/usr/lib/podkop_bot
async=root/usr/libexec/rpcd/podkop_bot_update_async
[ "$(cat version.txt)" = 0.20.3 ]
[ "$(sed -n 's/^PKG_VERSION:=//p' Makefile)" = 0.20.3 ]
[ "$(sed -n 's/^LUCI_APP_VERSION="\([^"]*\)".*/\1/p' root/usr/libexec/rpcd/podkop_bot)" = 0.20.3 ]
[ "$(sed -n 's/^BOT_VERSION="\([^"]*\)".*/\1/p' "$bot" | head -n1)" = 0.20.3-dev4 ]
(cd "$base" && sha256sum -c vendor.sha256)
[ "$(git hash-object "$bot")" = 89ec4bdc4d37d8637074a43a573945ab433f0ed9 ]
[ "$(git hash-object "$base/install.sh")" = c06f7f007e307de893e0dc2212fc61368de8cd05 ]
[ "$(git hash-object "$base/podkop_bot_init")" = cf729a3cc7040e3d8fd17e5d1da81cc336e33ec8 ]
grep -qx 'bot_commit=eb9db9524544ea7359d6d46b9c3378aa90fbfcd6' "$base/vendor.source"
grep -qx 'bot_blob=89ec4bdc4d37d8637074a43a573945ab433f0ed9' "$base/vendor.source"
grep -qx 'bot_sha256=496a99c93eaee753e3b87bd248da5c89a543294b79817f68d90321c40b72982b' "$base/vendor.source"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
sed -n '/^version_of(){/,/^}/p; /^ver_gt(){/,/^}/p' "$async" > "$tmp/version-functions.sh"
sh -n "$tmp/version-functions.sh"
. "$tmp/version-functions.sh"
printf '#!/bin/sh\nBOT_VERSION="0.20.3-dev4"\n' > "$tmp/bot"
[ "$(version_of "$tmp/bot")" = '0.20.3-dev4' ]
printf '#!/bin/sh\nBOT_VERSION="0.20.2"\n' > "$tmp/bot"
[ "$(version_of "$tmp/bot")" = '0.20.2' ]
printf '#!/bin/sh\nBOT_VERSION="$(touch /tmp/should-not-exist)"\n' > "$tmp/bot"
if version_of "$tmp/bot" >/dev/null; then echo 'FAIL: unsafe version input accepted' >&2; exit 1; fi

ver_gt 0.20.3-dev4 0.20.2
ver_gt 0.20.3-dev4 0.20.3-dev3
ver_gt 0.20.3 0.20.3-dev4
if ver_gt 0.20.3-dev4 0.20.3; then exit 1; fi
if ver_gt 0.20.3-dev4 0.20.3-dev4; then exit 1; fi
if ver_gt 0.20.2 0.20.3-dev4; then exit 1; fi
if ver_gt 0.20.3-dev4 0.20.3-dev4; then exit 1; fi
echo 'PASS: synced vendor, installer/init identity, and stable/dev update ordering'
