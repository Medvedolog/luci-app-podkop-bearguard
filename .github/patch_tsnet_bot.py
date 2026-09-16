#!/usr/bin/env python3
from pathlib import Path
import re
p=Path('root/usr/lib/podkop_bot/podkop_bot')
s=p.read_text(); orig=s
s=re.sub(r'singbox_supports_tailscale\(\) \{\n.*?\n\}', '''singbox_supports_tailscale() {
    [ -r /usr/lib/podkop_bot/tsnet-provider.sh ] || return 1
    . /usr/lib/podkop_bot/tsnet-provider.sh
    tsnet_capable
}''', s, count=1, flags=re.S)
anchor='# ── Tailscale server management (Forkop) ──────────────────────────────────────'
helpers='''# Shared tsnet backend for Telegram. Native Forkop, Forkop X and classic Podkop\n# converge on the same provider abstraction used by LuCI.\n_ts_backend_call() {\n    local _method="$1" _payload="${2:-{}}"\n    [ -x /usr/libexec/rpcd/podkop_bot_tailscale ] || return 1\n    printf '%s' "$_payload" | /usr/libexec/rpcd/podkop_bot_tailscale call "$_method" 2>/dev/null\n}\n_ts_backend_status() { _ts_backend_call status '{}'; }\n_ts_backend_provider() { _ts_backend_status | jq -r '.provider // "none"' 2>/dev/null; }\n_ts_backend_native() { [ "$(_ts_backend_provider)" = "forkop-native" ]; }\n\n'''
if helpers not in s: s=s.replace(anchor,helpers+anchor,1)
s=re.sub(r'_ts_find_existing\(\) \{\n.*?\n\}', '''_ts_find_existing() {
    local _st
    _st=$(_ts_backend_status 2>/dev/null) || return 1
    [ "$(printf '%s' "$_st" | jq -r '.configured // false' 2>/dev/null)" = "true" ] || return 1
    printf '%s' "$_st" | jq -r '.section // "podkop-bot-tailscale"' 2>/dev/null
}''', s, count=1, flags=re.S)
s=s.replace('_ts_gen_name() {\n    local _i=1 _n _state_dir','''_ts_gen_name() {
    if ! _ts_backend_native; then printf '%s' "podkop-bot-tailscale"; return 0; fi
    local _i=1 _n _state_dir''',1)
s=s.replace('''_ts_create() {
    local _n="$1" _url="$2" _key="$3" _exit="$4" _host="$5"''','''_ts_create() {
    local _n="$1" _url="$2" _key="$3" _exit="$4" _host="$5"
    _ts_backend_native || return 0''',1)
s=s.replace('''_ts_commit_created_disabled() {
    local _n="$1" _url="$2" _key="$3" _exit="$4" _host="$5"''','''_ts_commit_created_disabled() {
    local _n="$1" _url="$2" _key="$3" _exit="$4" _host="$5"
    if ! _ts_backend_native; then
        local _payload _r
        _payload=$(jq -cn --arg u "$_url" --arg k "$_key" --arg h "$_host" '{control_url:$u,auth_key:$k,hostname:$h,advertise_exit_node:false,confirm_standalone:true}') || return 1
        _r=$(_ts_backend_call create "$_payload") || return 1
        [ "$(printf '%s' "$_r" | jq -r '.ok // false' 2>/dev/null)" = "true" ]
        return
    fi''',1)
s=s.replace('''    if [ "$PODKOP_VARIANT" != "forkop" ]; then
        _handle_settings "section_settings" "$mid" "" ""
        return
    fi''','''    if [ "$PODKOP_VARIANT" != "forkop" ]; then
        case "$cmd" in ts_*|STATE_INPUT) ;; *) _handle_settings "section_settings" "$mid" "" ""; return ;; esac
    fi''',1)
s=s.replace('''                _existing_h=$(uci -q get "${PODKOP_UCI}.${_existing_ts}.tailscale_hostname" 2>/dev/null)
                _existing_en=$(uci -q get "${PODKOP_UCI}.${_existing_ts}.enabled" 2>/dev/null)''','''                if _ts_backend_native; then
                    _existing_h=$(uci -q get "${PODKOP_UCI}.${_existing_ts}.tailscale_hostname" 2>/dev/null)
                    _existing_en=$(uci -q get "${PODKOP_UCI}.${_existing_ts}.enabled" 2>/dev/null)
                else
                    local _bst; _bst=$(_ts_backend_status)
                    _existing_h=$(printf '%s' "$_bst" | jq -r '.hostname // empty')
                    [ "$(printf '%s' "$_bst" | jq -r '.enabled // false')" = true ] && _existing_en=1 || _existing_en=0
                fi''',1)
needle='''            _sn="${_rest%_[01]}"; _nv="${_rest##*_}"
            if [ "$(uci -q get "${PODKOP_UCI}.${_sn}.protocol" 2>/dev/null)" != "tailscale" ]; then'''
insert='''            _sn="${_rest%_[01]}"; _nv="${_rest##*_}"
            if ! _ts_backend_native; then
                if [ "$_key" != "enabled" ]; then CB_ANSWER_TEXT="В MVP для Podkop/Forkop X доступно только подключение tsnet"; return; fi
                local _confirm=false _payload _br
                [ "$_ts_confirmed" = "1" ] && _confirm=true
                _payload=$(jq -cn --argjson e "$([ "$_nv" = 1 ] && echo true || echo false)" --argjson c "$_confirm" '{enabled:$e,confirm_standalone:$c}')
                _br=$(_ts_backend_call set_enabled "$_payload")
                if [ "$(printf '%s' "$_br" | jq -r '.ok // false')" != true ]; then
                    send_message "$(printf '%s Не удалось изменить Tailscale: <code>%s</code>' "$E_WARN" "$(html_escape "$(printf '%s' "$_br" | jq -r '.reason // "backend_error"')")")" ""; return
                fi
                [ "$_nv" = 1 ] && send_message "$(printf '%s <b>Tailscale включён</b>. tsnet применяется fail-open overlay, не блокируя основной сервис.' "$E_OK")" "" || send_message "$(printf '%s Tailscale выключен.' "$E_OK")" ""
                return
            fi
            if [ "$(uci -q get "${PODKOP_UCI}.${_sn}.protocol" 2>/dev/null)" != "tailscale" ]; then'''
if needle not in s: raise SystemExit('toggle insertion point not found')
s=s.replace(needle,insert,1)
s=s.replace('if [ "$PODKOP_VARIANT" = "forkop" ] && singbox_supports_tailscale; then printf','if singbox_supports_tailscale; then printf')
s=s.replace('''if [ "$PODKOP_VARIANT" = "forkop" ] && singbox_supports_tailscale; then
                _ts_existing=$(_ts_find_existing)''','''if singbox_supports_tailscale; then
                _ts_existing=$(_ts_find_existing)''',1)
if s==orig: raise SystemExit('no changes made')
for x in ['_ts_backend_call()', 'tsnet_capable', 'podkop-bot-tailscale']:
    if x not in s: raise SystemExit('missing '+x)
p.write_text(s)
print('patched',len(orig),'->',len(s))
