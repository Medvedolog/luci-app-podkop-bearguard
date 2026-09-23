#!/bin/sh
# Podkop BearGuard (luci-app-podkop-bot) — install/update from GitHub Releases
# straight from the OpenWrt console.
#
#   wget -qO /tmp/bearguard-install.sh https://raw.githubusercontent.com/Medvedolog/luci-app-podkop-bearguard/main/bearguard-install.sh && sh /tmp/bearguard-install.sh
#
# OpenWrt 25.12+ (apk) gets the .apk asset, OpenWrt 24.10 and older (opkg)
# the _all.ipk. Only the BearGuard package itself is picked from a release:
# the same release also carries architecture-specific hwelp-proxy packages.
#
# Options:
#   --version TAG   install a specific release tag instead of the latest
#
# Behind a blocked GitHub, export a proxy first, for example:
#   export https_proxy=http://192.168.1.1:2080 http_proxy=http://192.168.1.1:2080

REPO="Medvedolog/luci-app-podkop-bearguard"
TAG=""

while [ $# -gt 0 ]; do
    case "$1" in
        --version) TAG="${2:-}"; shift 2 ;;
        --version=*) TAG="${1#*=}"; shift ;;
        -h|--help) sed -n '2,16p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
        *) echo "Unknown option: $1" >&2; exit 2 ;;
    esac
done

say()  { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u 2>/dev/null)" = 0 ] || fail "run as root on the router"
command -v jsonfilter >/dev/null 2>&1 || fail "jsonfilter not found (it is part of base OpenWrt)"
command -v wget >/dev/null 2>&1 || fail "wget not found"

if command -v apk >/dev/null 2>&1; then
    PM=apk
    ASSET_RE='/luci-app-podkop-bot[-_][^/]*\.apk$'
    PKG=/tmp/luci-app-podkop-bot.apk
elif command -v opkg >/dev/null 2>&1; then
    PM=opkg
    ASSET_RE='/luci-app-podkop-bot_[^/]*_all\.ipk$'
    PKG=/tmp/luci-app-podkop-bot.ipk
else
    fail "neither apk nor opkg found"
fi
say "Package manager: $PM"

if [ -n "$TAG" ]; then
    API="https://api.github.com/repos/$REPO/releases/tags/$TAG"
else
    API="https://api.github.com/repos/$REPO/releases/latest"
fi

say "Reading release info from GitHub..."
JSON="$(wget -qO- "$API")" || fail "cannot reach $API (set https_proxy if GitHub is blocked)"
REL="$(printf '%s' "$JSON" | jsonfilter -e '@.tag_name' 2>/dev/null)"
URL="$(printf '%s' "$JSON" | jsonfilter -e '@.assets[*].browser_download_url' 2>/dev/null | grep -E "$ASSET_RE" | head -n1)"
[ -n "$URL" ] || fail "no BearGuard $PM package in release ${REL:-?}"
say "Release: ${REL:-?}"
say "Package: ${URL##*/}"

# Refresh package indexes so luci-base, jq and curl can be resolved.
say "Updating $PM package lists..."
if [ "$PM" = apk ]; then
    apk update >/dev/null 2>&1 || say "WARNING: apk update failed; continuing with cached indexes"
else
    opkg update >/dev/null 2>&1 || say "WARNING: opkg update failed; continuing with cached lists"
fi

rm -f "$PKG"
say "Downloading..."
wget -qO "$PKG" "$URL" || fail "download failed"
[ -s "$PKG" ] || fail "downloaded file is empty"

say "Installing..."
if [ "$PM" = apk ]; then
    # A single APK from GitHub Releases is not in a configured apk repository,
    # so apk needs --allow-untrusted for it.
    apk add --allow-untrusted "$PKG" || fail "apk add failed"
else
    opkg install "$PKG" || fail "opkg install failed"
fi
rm -f "$PKG"

say ""
say "Podkop BearGuard ${REL:-} installed."
say "Open LuCI -> Services -> Podkop BearGuard. If the bot is not installed yet, start with the Setup Wizard."
