#!/bin/sh
# Give hwelp-proxy the release's package version before it is built.
#
# The community owfeed feed serves one source archive per release and hands it
# out only under package names whose assets start with <name>-<release version>
# (apk) or <name>_<release version> (ipk). A GPL package built from the same tag
# under its own version (hwelp-proxy 0.1.1-r3 next to 0.19.19-rN) is left without
# source there, and the feed then refuses the whole release. So hwelp is always
# versioned with the release it ships in.
#
# usage: tools/hwelp-version.sh [dist/VERSION]   (default: dist/VERSION from stage.sh)
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/dist/VERSION}"
MK="$ROOT/hwelp-proxy/Makefile"

V="$(head -n1 "$SRC" 2>/dev/null || true)"
case "$V" in
    *-r[0-9]*) BASE="${V%-r*}"; REL="${V##*-r}" ;;
    *) echo "hwelp-version: expected X.Y.Z-rN in $SRC, got '${V:-missing}'" >&2; exit 1 ;;
esac
case "$REL" in ''|*[!0-9]*) echo "hwelp-version: bad release in '$V'" >&2; exit 1 ;; esac

sed -i -e "s/^PKG_VERSION:=.*/PKG_VERSION:=$BASE/" -e "s/^PKG_RELEASE:=.*/PKG_RELEASE:=$REL/" "$MK"
grep -qx "PKG_VERSION:=$BASE" "$MK" && grep -qx "PKG_RELEASE:=$REL" "$MK" || {
    echo "hwelp-version: failed to set $V in $MK" >&2; exit 1
}
echo "hwelp-proxy version $BASE-r$REL"
