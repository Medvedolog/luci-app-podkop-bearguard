#!/bin/sh
# Podkop BearGuard (luci-app-podkop-bot) — install/update from GitHub Releases
# straight from the OpenWrt console.
#
#   wget -qO- https://raw.githubusercontent.com/Medvedolog/luci-app-podkop-bearguard/main/bearguard-install.sh | sh
#   (pin a version: ... | sh -s -- --version 0.19.19)
#
# OpenWrt 25.12+ (apk) gets the .apk asset, OpenWrt 24.10 and older (opkg)
# the _all.ipk. The BearGuard package is architecture-independent; the same
# release also carries the native Bearhole gateway hwelp-proxy per architecture.
# hwelp lets OpenWrt's own curl/wget/opkg/apk reach GitHub through the proxy
# chain when direct access is blocked, and WARP account setup needs a route out,
# so this installer offers to install the matching hwelp too — it is the one
# place that already has a working route. Prebuilt hwelp exists only for a few
# architectures (aarch64 and x86_64); on others it is skipped.
#
# Options:
#   --version TAG   install a specific release tag instead of the latest
#   --with-hwelp    install hwelp-proxy without asking
#   --no-hwelp      do not install hwelp-proxy
#
# Behind a blocked GitHub, export a proxy first, for example:
#   export https_proxy=http://192.168.1.1:2080 http_proxy=http://192.168.1.1:2080

REPO="Medvedolog/luci-app-podkop-bearguard"
TAG=""
HWELP_MODE=ask

while [ $# -gt 0 ]; do
    case "$1" in
        --version) TAG="${2:-}"; shift 2 ;;
        --version=*) TAG="${1#*=}"; shift ;;
        --with-hwelp) HWELP_MODE=force; shift ;;
        --no-hwelp) HWELP_MODE=no; shift ;;
        -h|--help) sed -n '2,22p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'; exit 0 ;;
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
say "Podkop BearGuard ${REL:-} installed."

# hwelp-proxy: the native Bearhole gateway, architecture-specific, in the same
# release. Installing it here (where a route out exists) means Bearhole and WARP
# account setup work later even if the router cannot reach GitHub directly. A
# failure here never fails the BearGuard install.
install_hwelp() {
    [ "$HWELP_MODE" = no ] && { say "hwelp-proxy: skipped (--no-hwelp)."; return 0; }

    ARCH=""
    [ -r /etc/openwrt_release ] && ARCH="$(. /etc/openwrt_release 2>/dev/null; printf '%s' "${DISTRIB_ARCH:-}")"
    [ -n "$ARCH" ] || ARCH="$(uname -m 2>/dev/null)"

    if [ "$PM" = apk ]; then
        HRE="/hwelp-proxy-[^\"/]*_${ARCH}[.]apk\$"; HPKG=/tmp/hwelp-proxy.apk
    else
        HRE="/hwelp-proxy_[^\"/]*_${ARCH}[.]ipk\$"; HPKG=/tmp/hwelp-proxy.ipk
    fi
    HURL="$(printf '%s' "$JSON" | jsonfilter -e '@.assets[*].browser_download_url' 2>/dev/null | grep -E "$HRE" | head -n1)"

    if [ -z "$HURL" ]; then
        say ""
        say "hwelp-proxy: no prebuilt package for arch '${ARCH:-unknown}' in this release — skipped."
        say "The router works without it; Bearhole extras stay optional (build from source: hwelp-proxy/ in the repo)."
        return 0
    fi

    if [ "$HWELP_MODE" = ask ]; then
        if [ -r /dev/tty ]; then
            printf 'Install native Bearhole gateway %s? [Y/n] ' "${HURL##*/}" > /dev/tty
            read ans < /dev/tty 2>/dev/null || ans=y
            case "$ans" in [Nn]*) say "hwelp-proxy: skipped."; return 0 ;; esac
        else
            say "hwelp-proxy: installing too (run with --no-hwelp to skip)."
        fi
    fi

    say "Downloading hwelp-proxy (${ARCH})..."
    rm -f "$HPKG"
    wget -qO "$HPKG" "$HURL" || { say "WARNING: hwelp-proxy download failed; install it later from the Update page."; return 0; }
    [ -s "$HPKG" ] || { say "WARNING: hwelp-proxy download was empty; skipped."; rm -f "$HPKG"; return 0; }
    say "Installing hwelp-proxy..."
    if [ "$PM" = apk ]; then
        apk add --allow-untrusted "$HPKG" || say "WARNING: hwelp-proxy install failed; install it later from the Update page."
    else
        opkg install "$HPKG" || say "WARNING: hwelp-proxy install failed; install it later from the Update page."
    fi
    rm -f "$HPKG"
}
install_hwelp

say ""
say "Open LuCI -> Services -> Podkop BearGuard. If the bot is not installed yet, start with the Setup Wizard."
