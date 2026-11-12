#!/bin/sh
# Forkop2 RPC read side: an absent enabled option must NOT mean enabled.
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT HUP INT TERM
awk '/^emit_mixed_proxy\(\) \{/{p=1} p{print} p && /^}/ {exit}' root/usr/libexec/rpcd/podkop_bot > "$tmp/rpc.sh"
sh -n "$tmp/rpc.sh"
(
 . "$tmp/rpc.sh"
 _podkop_deprecated() { return 1; }
 podkop_uci_pkg() { printf '%s' forkop; }
 podkop_active_section() { printf '%s' section_3ebe13; }
 _forkop_v2() { return 0; }
 _bg_first_section() { printf '%s' section_3ebe13; }
 _forkop_mixed_server() { printf '%s' server_7563a8; }
 _json_str() { jq -Rn --arg x "$1" '$x'; }
 uci() {
   [ "$1" = -q ] && shift
   case "$1:$2" in
     show:forkop) printf '%s\n' 'forkop.settings=settings' ;;
     get:forkop.server_7563a8.listen_port) printf '%s\n' 2080 ;;
     get:forkop.server_7563a8.enabled) printf '%s\n' "$MOCK_ENABLED" ;;
     *) return 1 ;;
   esac
 }
 MOCK_ENABLED=''
 out=$(emit_mixed_proxy forkop 2.0.0)
 printf '{%s}\n' "$out" | jq -e '.mixed_proxy.available == true and .mixed_proxy.enabled == false and .mixed_proxy.port == 2080' >/dev/null
 MOCK_ENABLED=1
 out=$(emit_mixed_proxy forkop 2.0.0)
 printf '{%s}\n' "$out" | jq -e '.mixed_proxy.available == true and .mixed_proxy.enabled == true and .mixed_proxy.section == "section_3ebe13"' >/dev/null
)
echo 'Forkop2 Mixed RPC missing/true enabled and existing server mapping: OK'
