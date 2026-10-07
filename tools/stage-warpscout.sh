#!/bin/sh
# Stage a WARPSCOUT binary as the filesystem payload consumed by owfeed/mkpkg.
#
# Usage:
#   tools/stage-warpscout.sh <binary> <upstream-source-dir> [version]
#
# The first OpenWrt target is MT7621 / mipsel_24kc. WARPSCOUT is a fully
# static Go binary, so no OpenWrt SDK is required for packaging.
set -eu

[ "$#" -ge 2 ] && [ "$#" -le 3 ] || {
    echo "usage: $0 <binary> <upstream-source-dir> [version]" >&2
    exit 2
}

BIN="$1"
SRC="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_VERSION="$(tr -d '[:space:]' < "$ROOT/warpscout.version" 2>/dev/null || true)"
[ -n "$BASE_VERSION" ] || { echo "missing warpscout.version" >&2; exit 1; }
VERSION="${3:-${BASE_VERSION}-r1}"
OUT="${OUT:-$ROOT/dist}"
ARCH="mipsel_24kc"
PAYLOAD="$OUT/warpscout/$ARCH"

[ -s "$BIN" ] || { echo "warpscout binary missing: $BIN" >&2; exit 1; }
[ -s "$SRC/LICENSE" ] || { echo "warpscout LICENSE missing: $SRC/LICENSE" >&2; exit 1; }

rm -rf "$OUT/warpscout"
mkdir -p "$PAYLOAD/usr/bin" "$PAYLOAD/usr/share/licenses/warpscout"

cp "$BIN" "$PAYLOAD/usr/bin/warpscout"
chmod 0755 "$PAYLOAD/usr/bin/warpscout"
cp "$SRC/LICENSE" "$PAYLOAD/usr/share/licenses/warpscout/LICENSE"
chmod 0644 "$PAYLOAD/usr/share/licenses/warpscout/LICENSE"
printf '%s\n' "$VERSION" > "$OUT/WARPSCOUT_VERSION"

# Guard against accidentally packaging the wrong cross-build.
file "$PAYLOAD/usr/bin/warpscout" | grep -qi 'MIPS' || {
    echo "staged warpscout is not a MIPS binary" >&2
    file "$PAYLOAD/usr/bin/warpscout" >&2
    exit 1
}

echo "staged warpscout $VERSION for $ARCH"
