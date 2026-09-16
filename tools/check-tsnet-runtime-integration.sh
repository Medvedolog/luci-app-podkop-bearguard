#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

RPC=root/usr/libexec/rpcd/podkop_bot_tailscale
APPLY=root/usr/lib/podkop_bot/tsnet-runtime-apply.sh

[ -f "$RPC" ] || { echo "FAIL  tailscale rpc missing" >&2; exit 1; }
[ -f "$APPLY" ] || { echo "FAIL  one-shot tsnet runtime apply helper missing" >&2; exit 1; }
sh -n "$RPC"
sh -n "$APPLY"

[ ! -e root/etc/init.d/podkop-tsnet-overlay ] || { echo "FAIL  retired tsnet overlay service returned" >&2; exit 1; }
[ ! -e root/usr/lib/podkop_bot/tsnet-overlay-watch.sh ] || { echo "FAIL  retired tsnet watcher returned" >&2; exit 1; }

if grep -Eq '(^|[[:space:]])while[[:space:]]' "$APPLY"; then
    echo "FAIL  tsnet runtime helper must be one-shot, not a watcher" >&2
    exit 1
fi
if grep -Eq 'procd_|respawn|podkop-tsnet-overlay' "$APPLY" "$RPC"; then
    echo "FAIL  persistent tsnet lifecycle control returned" >&2
    exit 1
fi

grep -Fq 'RUNTIME_APPLY="/usr/lib/podkop_bot/tsnet-runtime-apply.sh"' "$RPC" || { echo "FAIL  rpc does not use one-shot runtime helper" >&2; exit 1; }
grep -Fq 'runtime_apply_failed' "$RPC" || { echo "FAIL  explicit runtime apply failure reporting missing" >&2; exit 1; }
grep -Fq 'volatile_runtime:true' "$RPC" || { echo "FAIL  non-native runtime volatility contract missing" >&2; exit 1; }
grep -Fq 'mv -f "$_tmp" "$_cfg"' "$APPLY" || { echo "FAIL  atomic runtime swap missing" >&2; exit 1; }
grep -Fq 'rollback=restart_failed' "$APPLY" || { echo "FAIL  restart rollback missing" >&2; exit 1; }

echo "watcher-free tsnet runtime integration contract OK"
