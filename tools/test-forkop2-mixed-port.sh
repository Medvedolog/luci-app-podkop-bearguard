#!/bin/sh
# Exercise the actual Forkop2 allocator with a mocked UCI database.
# It must never reuse 2080 when another server already reserved it.
set -eu
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
awk '
  /^# Forkop 2: create a routed mixed server/ {start=1}
  /^# -- mixed_proxy sub-object/ {exit}
  start {print}
' root/usr/libexec/rpcd/podkop_bot >"$tmp/allocator.sh"
grep -Fq '_bg_pick_port()' "$tmp/allocator.sh"
sh -n "$tmp/allocator.sh"
# Environment functions are overridden so this test NEVER changes router UCI.
(
  . "$tmp/allocator.sh"
  uci() {
    case "$*" in
      "-q show forkop") printf '%s\n' 'forkop.first=server' ;;
      "-q get forkop.first.listen_port") printf '%s\n' 2080 ;;
      *) return 1 ;;
    esac
  }
  _bg_port_used 2080 "" || { echo "FAIL: occupied 2080 reported free" >&2; exit 1; }
  # The above is inverted: used returns 0, so enforce that directly.
) >"$tmp/first.log" 2>&1 && {
  echo "FAIL: occupied-port semantics changed" >&2; cat "$tmp/first.log" >&2; exit 1;
}
(
  . "$tmp/allocator.sh"
  uci() {
    case "$*" in
      "-q show forkop") printf '%s\n' 'forkop.first=server' ;;
      "-q get forkop.first.listen_port") printf '%s\n' 2080 ;;
      *) return 1 ;;
    esac
  }
  _bg_port_used 2080 ""    # must succeed (occupied)
  if _bg_port_used 0 ""; then :; else echo "FAIL: invalid port accepted" >&2; exit 1; fi
  p=$(_bg_pick_port "")
  case "$p" in ''|*[!0-9]*) echo "FAIL: no numeric free port" >&2; exit 1 ;; esac
  [ "$p" -ge 2081 ] && [ "$p" -le 2280 ] || {
    echo "FAIL: expected next free port, got $p" >&2; exit 1;
  }
)
echo "Forkop 2 occupied-port allocator contract OK"
