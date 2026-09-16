#!/bin/sh

. /usr/lib/podkop_bot/tsnet-provider.sh

log() { logger -t podkop-bot-tsnet "$*"; }

endpoint_enabled() {
    [ "$(tsnet_state_get enabled)" = true ]
}

config_has_endpoint() {
    _cfg="$1"
    jq -e --arg tag "$TSNET_ENDPOINT_TAG" '(.endpoints // []) | any(.tag == $tag and .type == "tailscale")' "$_cfg" >/dev/null 2>&1
}

render_endpoint() {
    _host=$(tsnet_state_get hostname)
    _url=$(tsnet_state_get control_url)
    _key=$(tsnet_state_get auth_key)
    _adv=$(tsnet_state_get advertise_exit_node)
    _state=$(tsnet_state_get state_directory)
    [ -n "$_state" ] || _state="$TSNET_IDENTITY_DIR"

    jq -cn \
        --arg tag "$TSNET_ENDPOINT_TAG" \
        --arg hostname "$_host" \
        --arg control_url "$_url" \
        --arg auth_key "$_key" \
        --arg state_directory "$_state" \
        --argjson advertise_exit_node "${_adv:-false}" \
        '{type:"tailscale",tag:$tag,state_directory:$state_directory}
         + (if $hostname != "" then {hostname:$hostname} else {} end)
         + (if $control_url != "" then {control_url:$control_url} else {} end)
         + (if $auth_key != "" then {auth_key:$auth_key} else {} end)
         + (if $advertise_exit_node then {advertise_exit_node:true} else {} end)'
}

apply_overlay() {
    _cfg=$(tsnet_config_path)
    [ -r "$_cfg" ] || return 2
    jq -e . "$_cfg" >/dev/null 2>&1 || return 2

    _endpoint=$(render_endpoint) || return 1
    _dir=${_cfg%/*}; [ "$_dir" = "$_cfg" ] && _dir=.
    _tmp="$_dir/.podkop-bot-tsnet.$$"

    if endpoint_enabled; then
        jq --arg tag "$TSNET_ENDPOINT_TAG" --argjson ep "$_endpoint" \
            '.endpoints = (((.endpoints // []) | map(select(.tag != $tag))) + [$ep])' \
            "$_cfg" > "$_tmp" || { rm -f "$_tmp"; return 1; }
    else
        jq --arg tag "$TSNET_ENDPOINT_TAG" \
            'if has("endpoints") then .endpoints |= map(select(.tag != $tag)) else . end' \
            "$_cfg" > "$_tmp" || { rm -f "$_tmp"; return 1; }
    fi

    if command -v sing-box >/dev/null 2>&1; then
        sing-box check -c "$_tmp" >/dev/null 2>&1 || {
            rm -f "$_tmp"
            log "event=overlay_rejected reason=singbox_check_failed provider=$(tsnet_provider)"
            return 1
        }
    fi

    if cmp -s "$_cfg" "$_tmp"; then
        rm -f "$_tmp"
        return 0
    fi

    chmod --reference="$_cfg" "$_tmp" 2>/dev/null || chmod 600 "$_tmp" 2>/dev/null || true
    chown --reference="$_cfg" "$_tmp" 2>/dev/null || true
    mv -f "$_tmp" "$_cfg" || { rm -f "$_tmp"; return 1; }

    /etc/init.d/sing-box restart >/dev/null 2>&1 || {
        log "event=overlay_applied restart=failed provider=$(tsnet_provider)"
        return 1
    }
    log "event=overlay_applied restart=ok provider=$(tsnet_provider) enabled=$(tsnet_state_get enabled)"
    return 0
}

# One-shot mode is used by rpcd for immediate apply/remove.
if [ "$1" = "--once" ]; then
    apply_overlay
    exit $?
fi

last_sig=""
while endpoint_enabled; do
    cfg=$(tsnet_config_path)
    if [ -r "$cfg" ]; then
        sig=$(stat -c '%Y:%s' "$cfg" 2>/dev/null)
        [ -n "$sig" ] || sig=$(ls -ln "$cfg" 2>/dev/null | awk '{print $5":"$6":"$7":"$8}')
        if [ "$sig" != "$last_sig" ]; then
            # Do not race the provider while it is still replacing its generated JSON.
            sleep 1
            sig2=$(stat -c '%Y:%s' "$cfg" 2>/dev/null)
            [ -n "$sig2" ] || sig2=$(ls -ln "$cfg" 2>/dev/null | awk '{print $5":"$6":"$7":"$8}')
            if [ "$sig" = "$sig2" ]; then
                apply_overlay >/dev/null 2>&1 || true
                last_sig=$(stat -c '%Y:%s' "$cfg" 2>/dev/null)
            fi
        fi
    fi
    sleep 3
done

exit 0
