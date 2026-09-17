#!/bin/sh
# Opt-in, cron-driven tsnet runtime recovery for Podkop/Forkop X.
# No daemon, no polling loop: one cheap check per cron invocation.

. /usr/lib/podkop_bot/tsnet-provider.sh

RUNTIME_APPLY="/usr/lib/podkop_bot/tsnet-runtime-apply.sh"
STAMP_DIR="/tmp/podkop-bot-tsnet"
STAMP_FILE="$STAMP_DIR/auto-repair.last"
COOLDOWN=300

[ -r "$TSNET_STATE_FILE" ] || exit 0
[ "$(tsnet_state_get auto_repair)" = true ] || exit 0
[ "$(tsnet_state_get enabled)" = true ] || exit 0

_provider=$(tsnet_provider)
case "$_provider" in
    podkop|forkop-x) ;;
    *) exit 0 ;;
esac

# Never compete with Forkop X while it owns its reload transaction.
[ ! -e /var/run/forkop.reload.lock ] || exit 0

_cfg=$(tsnet_config_path)
[ -r "$_cfg" ] || exit 0

# Nothing to repair when our endpoint survived the provider regeneration.
jq -e --arg t "$TSNET_ENDPOINT_TAG" '(.endpoints // []) | any(.type=="tailscale" and .tag==$t)' "$_cfg" >/dev/null 2>&1 && exit 0

# Do not attempt recovery while the dataplane is down for unrelated reasons.
if [ -x /etc/init.d/sing-box ]; then
    /etc/init.d/sing-box running >/dev/null 2>&1 || exit 0
else
    pidof sing-box >/dev/null 2>&1 || exit 0
fi

_now=$(date +%s 2>/dev/null || echo 0)
_last=0
[ -r "$STAMP_FILE" ] && _last=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
case "$_now:$_last" in
    *[!0-9:]*|0:*) ;;
    *) [ $((_now - _last)) -ge "$COOLDOWN" ] || exit 0 ;;
esac

mkdir -p "$STAMP_DIR" 2>/dev/null || exit 0
printf '%s\n' "$_now" > "$STAMP_FILE"

if [ -x "$RUNTIME_APPLY" ] && "$RUNTIME_APPLY" >/dev/null 2>&1; then
    logger -t podkop-bot-tsnet "event=auto_repair result=applied provider=$_provider" 2>/dev/null || true
    exit 0
fi

logger -t podkop-bot-tsnet "event=auto_repair result=failed provider=$_provider cooldown=${COOLDOWN}s" 2>/dev/null || true
exit 0
