#!/bin/sh
# OpenWrt Bearhole control plane for luci-app-podkop-bot.
# Keeps system proxy policy separate from Podkop/Forkop/WARPSCOUT routing.

BH_DIR=/tmp/podkop_bot/bearhole
BH_REGISTRY="$BH_DIR/routes.registry"
BH_ACTIVE="$BH_DIR/routes.conf"
BH_RESULTS="$BH_DIR/system.results"
BH_STATE="$BH_DIR/state"
BH_PID="$BH_DIR/qualify.pid"
BH_LOCK="$BH_DIR/qualify.lock"
BH_LOG="$BH_DIR/bearhole.log"
BH_GATEWAY="http://127.0.0.1:1066"
BH_BEGIN="# BEGIN PODKOP BEARHOLE"
BH_END="# END PODKOP BEARHOLE"

mkdir -p "$BH_DIR" 2>/dev/null

bh_log() {
    logger -t podkop-bearhole "$*" 2>/dev/null || true
    printf '%s %s\n' "$(date +%s 2>/dev/null || echo 0)" "$*" >> "$BH_LOG" 2>/dev/null || true
}

bh_json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n\r\t' '   '; }
bh_json_str() { printf '"%s"' "$(bh_json_escape "$1")"; }
bh_mask_proxy() { printf '%s' "$1" | sed -E 's|(://[^:@/]+:)[^@/]*@|\1***@|'; }
bh_section_id() {
    _s=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_]+/_/g; s/^_+//; s/_+$//')
    [ -n "$_s" ] || _s=route
    printf 'section_%s' "$_s"
}

bh_cfg_get() {
    _k="$1"; _d="$2"
    _v=$(uci -q get "podkop_bearhole.main.$_k" 2>/dev/null)
    [ -n "$_v" ] && printf '%s' "$_v" || printf '%s' "$_d"
}

bh_cfg_set() {
    _k="$1"; _v="$2"
    uci -q get podkop_bearhole.main >/dev/null 2>&1 || uci -q set podkop_bearhole.main=bearhole
    uci -q set "podkop_bearhole.main.$_k=$_v" && uci -q commit podkop_bearhole
}

bh_state_write() {
    _state="$1"; _reason="$2"; _now=$(date +%s 2>/dev/null || echo 0)
    _tmp="$BH_STATE.$$"
    {
        printf 'state=%s\n' "$_state"
        printf 'reason=%s\n' "$_reason"
        printf 'updated_at=%s\n' "$_now"
    } > "$_tmp" && mv "$_tmp" "$BH_STATE"
}

bh_state_get() { [ -s "$BH_STATE" ] && sed -n "s/^$1=//p" "$BH_STATE" | head -n1; }

bh_registry() {
    _tmp="$BH_REGISTRY.$$"; : > "$_tmp"
    _ts=$(ubus call podkop_bot transport_state '{}' 2>/dev/null || true)
    _rs=$(ubus call podkop_bot runtime_sections '{}' 2>/dev/null || true)
    _prio=10

    if [ -n "$_ts" ]; then
        _t1=$(printf '%s' "$_ts" | jq -r 'if (.tier1.mixed_proxy_enabled == true) then (.tier1.endpoint // "") else "" end' 2>/dev/null)
        if [ -n "$_t1" ]; then
            printf 'tier1|Podkop/Forkop Mixed Proxy|%s|proxy|%s\n' "$_t1" "$_prio" >> "$_tmp"
            _prio=$((_prio+10))
        fi
    fi

    if [ -n "$_rs" ]; then
        _primary=$(printf '%s' "$_rs" | jq -r '.primary_section // ""' 2>/dev/null)
        printf '%s' "$_rs" | jq -r --arg p "$_primary" '.sections[]? | select(.name != $p and .enabled_for_runtime == true and (.endpoint // "") != "") | [(.name // "route"), (.endpoint // "")] | @tsv' 2>/dev/null |
        while IFS="	" read -r _name _ep; do
            [ -n "$_ep" ] || continue
            _sid=$(bh_section_id "$_name")
            printf '%s|Podkop/Forkop: %s|%s|proxy|%s\n' "$_sid" "$_name" "$_ep" "$_prio"
            _prio=$((_prio+10))
        done >> "$_tmp"
    fi

    if [ -n "$_ts" ]; then
        _i=0
        printf '%s' "$_ts" | jq -r '.tier2_fallback_socks[]? // empty' 2>/dev/null |
        while IFS= read -r _fb; do
            [ -n "$_fb" ] || continue
            case "$_fb" in *'#WARP-SCOUT'*) continue;; esac
            _i=$((_i+1))
            _ep=${_fb%%#*}
            [ -n "$_ep" ] || continue
            printf 'tier2_%s|Fallback proxy #%s|%s|proxy|%s\n' "$_i" "$_i" "$_ep" "$_prio"
            _prio=$((_prio+10))
        done >> "$_tmp"
        _t3=$(printf '%s' "$_ts" | jq -r '.tier3_custom_proxy // ""' 2>/dev/null)
        _t3=${_t3%%#*}
        if [ -n "$_t3" ]; then
            printf 'tier3|Custom proxy|%s|proxy|%s\n' "$_t3" "$_prio" >> "$_tmp"
            _prio=$((_prio+10))
        fi
    fi

    _wr=$(ubus call podkop_bot_warpscout_rescue status '{}' 2>/dev/null || true)
    if [ -n "$_wr" ] && [ "$(printf '%s' "$_wr" | jq -r '.running // false' 2>/dev/null)" = true ]; then
        _wep=$(printf '%s' "$_wr" | jq -r '.proxy // ""' 2>/dev/null)
        _wnode=$(ubus call podkop_bot_warpscout status '{"force":""}' 2>/dev/null | jq -r '.active_snapshot.node // ""' 2>/dev/null)
        [ -n "$_wnode" ] || _wnode=WARP
        [ -n "$_wep" ] && printf 'warp_rescue|WARP Rescue / %s|%s|proxy|%s\n' "$_wnode" "$_wep" "$_prio" >> "$_tmp"
        _prio=$((_prio+10))
    fi

    _policy=$(printf '%s' "$_ts" | jq -r '.policy // "auto"' 2>/dev/null)
    [ "$_policy" = socks ] || printf 'direct|Direct|direct://|direct|999\n' >> "$_tmp"

    awk -F'|' '!seen[$1]++' "$_tmp" > "$BH_REGISTRY" && rm -f "$_tmp"
    chmod 600 "$BH_REGISTRY" 2>/dev/null
    [ -s "$BH_REGISTRY" ]
}

bh_write_bootstrap_routes() {
    bh_registry || return 1
    cp "$BH_REGISTRY" "$BH_ACTIVE" || return 1
    chmod 600 "$BH_ACTIVE" 2>/dev/null
    return 0
}

bh_feed_targets() {
    _tmp="$BH_DIR/feeds.$$"; : > "$_tmp"
    if [ -d /etc/apk/repositories.d ]; then
        grep -hEo 'https?://[^[:space:]#]+' /etc/apk/repositories.d/* 2>/dev/null >> "$_tmp" || true
    fi
    for _f in /etc/opkg/distfeeds.conf /etc/opkg/customfeeds.conf /etc/opkg/*.conf; do
        [ -f "$_f" ] || continue
        awk '$1 ~ /^src/ && $3 ~ /^https?:\/\// {u=$3; sub(/[[:space:]]+$/, "", u); print u "/Packages.gz"}' "$_f" 2>/dev/null >> "$_tmp" || true
    done
    if [ ! -s "$_tmp" ]; then printf '%s\n' 'https://downloads.openwrt.org/' > "$_tmp"; fi
    awk '!seen[$0]++' "$_tmp"
    rm -f "$_tmp"
}

bh_curl() {
    _ep="$1"; shift
    if [ "$_ep" = direct:// ]; then
        curl -q -4 -L -fsS --proxy '' --connect-timeout 5 --max-time 15 "$@"
    else
        curl -q -4 -L -fsS --proxy "$_ep" --connect-timeout 5 --max-time 18 "$@"
    fi
}

bh_probe_small() {
    _ep="$1"; _url="$2"; _out="$3"
    rm -f "$_out" 2>/dev/null
    bh_curl "$_ep" --range 0-2047 -o "$_out" "$_url" >/dev/null 2>&1
}

bh_probe_route() {
    _id="$1"; _label="$2"; _ep="$3"
    _tmp="$BH_DIR/probe.$$.tmp"; _api="$BH_DIR/api.$$.json"
    _core=fail; _raw=fail; _ghapi=fail; _codeload=fail; _asset=skip; _feeds=ok

    bh_probe_small "$_ep" 'https://github.com/' "$_tmp" && _core=ok
    bh_probe_small "$_ep" 'https://raw.githubusercontent.com/Medvedolog/luci-app-podkop-bot/main/version.txt' "$_tmp" && _raw=ok
    if bh_probe_small "$_ep" 'https://api.github.com/repos/Medvedolog/luci-app-podkop-bot/releases/latest' "$_api"; then
        _ghapi=ok
        _asset_url=$(jq -r '.assets[0].browser_download_url // empty' "$_api" 2>/dev/null)
        if [ -n "$_asset_url" ]; then
            _asset=fail
            bh_probe_small "$_ep" "$_asset_url" "$_tmp" && _asset=ok
        fi
    fi
    bh_probe_small "$_ep" 'https://codeload.github.com/Medvedolog/luci-app-podkop-bot/tar.gz/refs/heads/main' "$_tmp" && _codeload=ok

    for _feed in $(bh_feed_targets); do
        bh_probe_small "$_ep" "$_feed" "$_tmp" || { _feeds=fail; break; }
    done

    rm -f "$_tmp" "$_api" 2>/dev/null
    _status=FAIL
    if [ "$_core" = ok ] && [ "$_raw" = ok ] && [ "$_ghapi" = ok ] && [ "$_codeload" = ok ] && [ "$_feeds" = ok ] && { [ "$_asset" = ok ] || [ "$_asset" = skip ]; }; then
        _status=VALID
    elif [ "$_core" = ok ] || [ "$_raw" = ok ] || [ "$_feeds" = ok ]; then
        _status=DEGRADED
    fi
    _now=$(date +%s 2>/dev/null || echo 0)
    printf '%s|%s|%s|%s|%s|%s|%s|%s|%s|%s\n' "$_id" "$_label" "$_ep" "$_core" "$_raw" "$_ghapi" "$_codeload" "$_asset" "$_feeds" "$_status|$_now"
}

bh_select_valid_routes() {
    [ -s "$BH_REGISTRY" ] || bh_registry || return 1
    [ -s "$BH_RESULTS" ] || { bh_write_bootstrap_routes; return $?; }
    _cur=$(cat "$BH_DIR/current" 2>/dev/null | cut -d'|' -f1)
    _tmp="$BH_ACTIVE.$$"; : > "$_tmp"
    if [ -n "$_cur" ]; then
        awk -F'|' -v id="$_cur" 'NR==FNR{if($1==id && $10=="VALID")ok=1;next} ok && $1==id{print;exit}' "$BH_RESULTS" "$BH_REGISTRY" >> "$_tmp"
    fi
    awk -F'|' 'NR==FNR{if($10=="VALID")v[$1]=1;next} v[$1]{print}' "$BH_RESULTS" "$BH_REGISTRY" |
        awk -F'|' -v cur="$_cur" '$1!=cur' >> "$_tmp"
    if [ ! -s "$_tmp" ]; then
        : > "$BH_ACTIVE"
        rm -f "$_tmp"
        bh_state_write degraded no_system_valid_route
        return 1
    fi
    mv "$_tmp" "$BH_ACTIVE"; chmod 600 "$BH_ACTIVE" 2>/dev/null
    bh_state_write ready system_valid_routes
    return 0
}

bh_qualify() {
    mkdir "$BH_LOCK" 2>/dev/null || return 1
    printf '%s\n' "$$" > "$BH_PID"
    trap 'rm -rf "$BH_LOCK" "$BH_PID" 2>/dev/null' EXIT INT TERM HUP
    bh_state_write probing system_qualification
    bh_registry || { bh_state_write degraded no_routes; return 1; }
    _tmp="$BH_RESULTS.$$"; : > "$_tmp"
    while IFS='|' read -r _id _label _ep _type _prio; do
        [ -n "$_id" ] || continue
        bh_log "event=bearhole_probe_start route=$_id"
        _line=$(bh_probe_route "$_id" "$_label" "$_ep")
        printf '%s\n' "$_line" >> "$_tmp"
        _res=$(printf '%s' "$_line" | awk -F'|' '{print $10}')
        bh_log "event=bearhole_probe route=$_id profile=system result=$(printf '%s' "$_res" | tr '[:upper:]' '[:lower:]')"
    done < "$BH_REGISTRY"
    mv "$_tmp" "$BH_RESULTS"; chmod 600 "$BH_RESULTS" 2>/dev/null
    bh_select_valid_routes || true
    return 0
}

bh_qualify_start() {
    [ -d "$BH_LOCK" ] && return 2
    ( "$0" qualify >/dev/null 2>&1 ) &
    return 0
}

bh_strip_block() {
    _file="$1"; [ -f "$_file" ] || return 0
    _tmp="$_file.bearhole.$$"
    awk -v b="$BH_BEGIN" -v e="$BH_END" '$0==b{skip=1;next}$0==e{skip=0;next}!skip{print}' "$_file" > "$_tmp" && mv "$_tmp" "$_file"
}

bh_append_block() {
    _file="$1"; shift
    mkdir -p "$(dirname "$_file")" 2>/dev/null
    [ -f "$_file" ] || : > "$_file"
    bh_strip_block "$_file"
    {
        printf '%s\n' "$BH_BEGIN"
        for _line in "$@"; do printf '%s\n' "$_line"; done
        printf '%s\n' "$BH_END"
    } >> "$_file"
}

bh_system_on() {
    mkdir -p /etc/profile.d /root 2>/dev/null
    cat > /etc/profile.d/99-podkop-bearhole.sh <<EOF2
# Managed by luci-app-podkop-bot OpenWrt Bearhole.
export http_proxy=$BH_GATEWAY
export https_proxy=$BH_GATEWAY
export HTTP_PROXY=$BH_GATEWAY
export HTTPS_PROXY=$BH_GATEWAY
export no_proxy=127.0.0.1,localhost,::1
export NO_PROXY=127.0.0.1,localhost,::1
EOF2
    chmod 0644 /etc/profile.d/99-podkop-bearhole.sh 2>/dev/null

    bh_append_block /etc/environment \
        "http_proxy=$BH_GATEWAY" "https_proxy=$BH_GATEWAY" \
        "HTTP_PROXY=$BH_GATEWAY" "HTTPS_PROXY=$BH_GATEWAY" \
        "no_proxy=127.0.0.1,localhost,::1" "NO_PROXY=127.0.0.1,localhost,::1"

    bh_append_block /root/.curlrc \
        "proxy = \"$BH_GATEWAY\"" \
        'noproxy = "127.0.0.1,localhost,::1"'

    bh_append_block /root/.wgetrc \
        'use_proxy = on' \
        "http_proxy = $BH_GATEWAY" \
        "https_proxy = $BH_GATEWAY" \
        'no_proxy = 127.0.0.1,localhost,::1'

    if [ -d /etc/opkg ]; then
        cat > /etc/opkg/99-podkop-bearhole.conf <<EOF2
option http_proxy $BH_GATEWAY
option https_proxy $BH_GATEWAY
option no_proxy 127.0.0.1,localhost,::1
EOF2
    fi
    bh_log 'event=bearhole_enable gateway=127.0.0.1:1066'
}

bh_system_off() {
    rm -f /etc/profile.d/99-podkop-bearhole.sh /etc/opkg/99-podkop-bearhole.conf 2>/dev/null
    bh_strip_block /etc/environment
    bh_strip_block /root/.curlrc
    bh_strip_block /root/.wgetrc
    bh_log 'event=bearhole_disable'
}

bh_status() {
    _en=$(bh_cfg_get enabled 0); [ "$_en" = 1 ] && _enj=true || _enj=false
    _state=$(bh_state_get state); [ -n "$_state" ] || _state=idle
    _reason=$(bh_state_get reason); _upd=$(bh_state_get updated_at); [ -n "$_upd" ] || _upd=0
    _pid=$(ubus call service list '{"name":"podkop-bearhole"}' 2>/dev/null | jq -r '.["podkop-bearhole"].instances[]?.pid // 0' 2>/dev/null | head -n1)
    case "$_pid" in ''|*[!0-9]*) _pid=0;; esac
    _running=false; [ "$_pid" -gt 0 ] 2>/dev/null && kill -0 "$_pid" 2>/dev/null && _running=true
    _cur_id=$(cut -d'|' -f1 "$BH_DIR/current" 2>/dev/null); _cur_label=$(cut -d'|' -f2- "$BH_DIR/current" 2>/dev/null)
    _valid=$(awk -F'|' '$10=="VALID"{n++}END{print n+0}' "$BH_RESULTS" 2>/dev/null)
    _degraded=$(awk -F'|' '$10=="DEGRADED"{n++}END{print n+0}' "$BH_RESULTS" 2>/dev/null)
    _system_applied=false; [ -f /etc/profile.d/99-podkop-bearhole.sh ] && _system_applied=true
    printf '{"ok":true,"enabled":%s,"running":%s,"state":%s,"reason":%s,"updated_at":%s,"gateway":"http://127.0.0.1:1066","route_id":%s,"route_label":%s,"system_applied":%s,"valid_routes":%s,"degraded_routes":%s,"probing":%s,"pid":%s}\n' \
        "$_enj" "$_running" "$(bh_json_str "$_state")" "$(bh_json_str "$_reason")" "$_upd" \
        "$(bh_json_str "$_cur_id")" "$(bh_json_str "$_cur_label")" "$_system_applied" "${_valid:-0}" "${_degraded:-0}" "$([ -d "$BH_LOCK" ] && echo true || echo false)" "$_pid"
}

bh_results_json() {
    printf '{"ok":true,"items":['; _first=1
    while IFS='|' read -r _id _label _ep _core _raw _api _codeload _asset _feeds _status _checked; do
        [ -n "$_id" ] || continue
        [ "$_first" = 1 ] && _first=0 || printf ','
        printf '{"id":%s,"label":%s,"endpoint":%s,"github_core":"%s","github_raw":"%s","github_api":"%s","github_codeload":"%s","github_assets":"%s","openwrt_feeds":"%s","status":"%s","checked_at":%s}' \
            "$(bh_json_str "$_id")" "$(bh_json_str "$_label")" "$(bh_json_str "$(bh_mask_proxy "$_ep")")" \
            "$_core" "$_raw" "$_api" "$_codeload" "$_asset" "$_feeds" "$_status" "${_checked:-0}"
    done < "$BH_RESULTS" 2>/dev/null
    printf ']}\n'
}

bh_enable() {
    bh_cfg_set enabled 1 || return 1
    bh_write_bootstrap_routes || true
    bh_system_on
    /etc/init.d/podkop-bearhole enable >/dev/null 2>&1 || true
    /etc/init.d/podkop-bearhole restart >/dev/null 2>&1 || true
    bh_state_write probing enabled
    bh_qualify_start || true
}

bh_disable() {
    bh_cfg_set enabled 0 || return 1
    /etc/init.d/podkop-bearhole stop >/dev/null 2>&1 || true
    /etc/init.d/podkop-bearhole disable >/dev/null 2>&1 || true
    bh_system_off
    bh_state_write disabled user
}

case "${1:-}" in
    registry) bh_registry ;;
    bootstrap) bh_write_bootstrap_routes ;;
    qualify) bh_qualify ;;
    qualify-start) bh_qualify_start ;;
    select) bh_select_valid_routes ;;
    system-on) bh_system_on ;;
    system-off) bh_system_off ;;
    status) bh_status ;;
    results) bh_results_json ;;
    enable) bh_enable ;;
    disable) bh_disable ;;
    *) echo "usage: $0 {registry|bootstrap|qualify|qualify-start|select|system-on|system-off|status|results|enable|disable}" >&2; exit 2 ;;
esac
