from pathlib import Path
import re


def replace_one(path, old, new):
    p = Path(path)
    s = p.read_text()
    n = s.count(old)
    assert n == 1, f"{path}: expected one exact match, got {n}"
    p.write_text(s.replace(old, new, 1))


# 1. Manual per-node TG API checks must keep their result visible. The old
# delayed full-page refresh erased the status span and could catch Rescue while
# it was still restoring, leaving all freshly rendered controls disabled.
replace_one(
    'root/www/luci-static/resources/view/podkop-bot/warpscout.js',
    "}).finally(function(){btn.disabled=false;window.setTimeout(function(){self.refreshView();},1800);});",
    "}).finally(function(){btn.disabled=false;});"
)

# 2. Revolver reload: make orchestration acknowledge the JSON result of ubus
# calls and close the tiny done-state/PID-file race between Discovery and the
# Telegram qualification worker.
p = Path('root/usr/libexec/rpcd/podkop_bot_warpscout_rescue')
s = p.read_text()
pat = re.compile(
    r'wait_action_done\(\)\{\n.*?\n\}\nwait_tgscan_done\(\)\{\n.*?\n\}\n\nreload_magazine\(\)\{',
    re.S,
)
new_wait = r'''wait_pid_gone(){
	_pf="$1"; _limit="$2"; _n=0
	while pid_alive "$_pf" && [ "$_n" -lt "$_limit" ]; do sleep 1; _n=$((_n+1)); done
	pid_alive "$_pf" && return 1
	return 0
}
wait_action_done(){
	_limit="$1"; _n=0
	while [ "$_n" -lt "$_limit" ]; do
		_s=$(head -n1 "$ACTION_STATE" 2>/dev/null)
		case "$_s" in
			done\ 0) wait_pid_gone "$ACTION_PID" 5; return $?;;
			error\ *|done\ *) return 1;;
		esac
		sleep 1; _n=$((_n+1))
	done
	return 1
}
wait_tgscan_done(){
	_limit="$1"; _n=0
	while [ "$_n" -lt "$_limit" ]; do
		_s=$(sed -n 's/^state=//p' "$TGSCAN_STATE" 2>/dev/null | head -n1)
		case "$_s" in
			done) wait_pid_gone "$TGSCAN_PID" 5; return $?;;
			cancelled|stale) return 1;;
		esac
		if ! pid_alive "$TGSCAN_PID" && [ "$_s" != running ] && [ -n "$_s" ]; then return 1; fi
		sleep 1; _n=$((_n+1))
	done
	return 1
}
rpc_ok(){ printf '%s' "$1" | jq -e '.ok == true' >/dev/null 2>&1; }
rpc_reason(){ printf '%s' "$1" | jq -r '.reason // "rpc_rejected"' 2>/dev/null; }

reload_magazine(){'''
s, n = pat.subn(new_wait, s, count=1)
assert n == 1, f'rescue wait/reload prelude: expected one match, got {n}'

pat = re.compile(r'reload_magazine\(\)\{\n.*?\n\}\n\nfire_worker\(\)\{', re.S)
new_reload = r'''reload_magazine(){
	state_write reloading "" 0 0 discovery
	echo "[rescue] reload: running Discovery"
	_resp=$(ubus call podkop_bot_warpscout action_run '{"action":"scan","target":""}' 2>/dev/null) || { echo "[rescue] reload: Discovery RPC failed"; return 1; }
	if ! rpc_ok "$_resp"; then echo "[rescue] reload: Discovery rejected: $(rpc_reason "$_resp")"; return 1; fi
	wait_action_done 300 || { echo "[rescue] reload: Discovery failed or timed out"; return 1; }
	state_write reloading "" 0 0 qualification
	echo "[rescue] reload: Discovery complete, running TG qualification"
	_resp=$(ubus call podkop_bot_warpscout_tgscan telegram_scan_start '{}' 2>/dev/null) || { echo "[rescue] reload: TG qualification RPC failed"; return 1; }
	if ! rpc_ok "$_resp"; then echo "[rescue] reload: TG qualification rejected: $(rpc_reason "$_resp")"; return 1; fi
	wait_tgscan_done 480 || { echo "[rescue] reload: TG qualification failed or timed out"; return 1; }
	state_write reloading "" 0 0 building
	build_magazine || { echo "[rescue] reload: no VALID WARP routes in TG results"; return 1; }
	_total=$(magazine_count)
	[ "$_total" -gt 0 ] 2>/dev/null || { echo "[rescue] reload: empty magazine after build"; return 1; }
	cfg_write enabled 1 || return 1
	echo "[rescue] reload: magazine ready, $_total VALID WARP routes; WARP Rescue enabled"
	return 0
}

fire_worker(){'''
s, n = pat.subn(new_reload, s, count=1)
assert n == 1, f'rescue reload body: expected one match, got {n}'
p.write_text(s)

# 3. Bearhole is no longer a future placeholder; keep the Revolver copy honest.
replace_one(
    'root/www/luci-static/resources/view/podkop-bot/warpscout-rescue.js',
    "OpenWrt Rescue / Bearhole: аварийный рубильник предусмотрен в backend, но пока не влияет на маршрутизацию.",
    "OpenWrt Bearhole управляется в «Цепочке прокси» и может использовать WARP Rescue как один из системных резервных маршрутов."
)

# 4. Package/version.txt are 0.19.18 already; backend app_info must agree.
replace_one(
    'root/usr/libexec/rpcd/podkop_bot',
    'LUCI_APP_VERSION="0.19.17"',
    'LUCI_APP_VERSION="0.19.18"'
)

# 5. Static regression guards for failures that node --check cannot catch.
p = Path('tools/check-sources.sh')
s = p.read_text()
marker = '[ "$fail" -eq 0 ] || { echo "source checks failed"; exit 1; }\necho "source checks passed"'
assert s.count(marker) == 1
checks = r'''# Runtime/LuCI regression guards (0.19.18-r20+).
OVERVIEW_ASYNC="root/www/luci-static/resources/view/podkop-bot/overview-async.js"
grep -Fq 'return base.constructor.extend({' "$OVERVIEW_ASYNC" || {
    echo "LuCI: overview async wrapper must return a constructor" >&2; fail=1
}
if grep -Fq 'return base;' "$OVERVIEW_ASYNC"; then
    echo "LuCI: overview async wrapper returns an injected instance" >&2; fail=1
fi
WARPSCOUT_JS="root/www/luci-static/resources/view/podkop-bot/warpscout.js"
if grep -Fq 'self.refreshView();},1800' "$WARPSCOUT_JS"; then
    echo "WARPSCOUT: manual TG result-erasing delayed refresh returned" >&2; fail=1
fi
RESCUE_RPC="root/usr/libexec/rpcd/podkop_bot_warpscout_rescue"
grep -Fq 'wait_pid_gone(){' "$RESCUE_RPC" || {
    echo "WARP Rescue: worker completion race guard missing" >&2; fail=1
}
grep -Fq "jq -e '.ok == true'" "$RESCUE_RPC" || {
    echo "WARP Rescue: ubus JSON acknowledgement guard missing" >&2; fail=1
}

'''
p.write_text(s.replace(marker, checks + marker, 1))
