#!/bin/sh
# Cross-compile hwelp-proxy with an official OpenWrt toolchain, then stage only
# the resulting ELF for owfeed/mkpkg. Packaging is deliberately NOT done here.
set -eu

[ "$#" -eq 4 ] || {
    echo "usage: $0 <toolchain-url> <toolchain-sha256> <openwrt-arch> <output-dir>" >&2
    exit 2
}

TC_URL="$1"
TC_SHA="$2"
ARCH="$3"
OUT="$4"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM HUP

VERSION="$(cat "$OUT/VERSION" 2>/dev/null || true)"
[ -n "$VERSION" ] || { echo "missing $OUT/VERSION; stage LuCI first" >&2; exit 1; }

ARCHIVE="$TMP/toolchain.tar.zst"
echo "Downloading OpenWrt toolchain: $TC_URL"
curl -fL --retry 3 --retry-delay 2 -o "$ARCHIVE" "$TC_URL"
printf '%s  %s\n' "$TC_SHA" "$ARCHIVE" | sha256sum -c -

tar --zstd -xf "$ARCHIVE" -C "$TMP"
CC="$(find "$TMP" \( -type f -o -type l \) -path '*/bin/*-openwrt-linux-musl-gcc' -print | head -n1)"
[ -n "$CC" ] || CC="$(find "$TMP" \( -type f -o -type l \) -path '*/bin/*-openwrt-linux-gcc' -print | head -n1)"
[ -n "$CC" ] || CC="$(find "$TMP" \( -type f -o -type l \) -path '*/bin/*-gcc' -print | head -n1)"
[ -n "$CC" ] || { echo "cross compiler not found" >&2; find "$TMP" -path '*/bin/*gcc*' -print >&2; exit 1; }
echo "Using cross compiler: $CC"
TC_ROOT="$(dirname "$(dirname "$CC")")"
export STAGING_DIR="$TC_ROOT"

PAYLOAD="$OUT/hwelp-proxy/$ARCH"
mkdir -p "$PAYLOAD/usr/bin"

"$CC" -Os -pipe -std=c99 -Wall -Wextra -Wl,-s     -DHWELP_VERSION=\"$VERSION\"     -o "$PAYLOAD/usr/bin/hwelp-proxy"     "$ROOT/hwelp-proxy/src/hwelp-proxy.c"

chmod 0755 "$PAYLOAD/usr/bin/hwelp-proxy"

file "$PAYLOAD/usr/bin/hwelp-proxy"
readelf -h "$PAYLOAD/usr/bin/hwelp-proxy"
file "$PAYLOAD/usr/bin/hwelp-proxy" | grep -qi 'MIPS' || {
    echo "hwelp-proxy is not a MIPS binary" >&2
    exit 1
}

echo "staged hwelp-proxy $VERSION for $ARCH"
