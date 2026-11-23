#!/bin/sh
# Exercise the real BearGuard RPC and Overview rendering without a router.
set -eu
cd "$(dirname "$0")/.."
rpcd=root/usr/libexec/rpcd/podkop_bot
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT INT TERM
for name in _bg_engine_status _bg_engine_rss method_resources _bg_package_version _bg_experimental_info method_singbox_info; do
	sed -n "/^$name() {/,/^}/p" "$rpcd"
done > "$T/functions.sh"
cat > "$T/fake-bot" <<'BOT'
#!/bin/sh
# Supports --engine-status-json (read-only)
[ "$1" = --engine-status-json ] || exit 9
[ -z "${MOCK_FAILED:-}" ] || exit 1
printf '%s\n' "${MOCK_STATE:-}"
BOT
cat > "$T/old-bot" <<'OLD'
#!/bin/sh
touch "$BAD_BOT_RUN"
OLD
cat > "$T/setup.sh" <<'SETUP'
ENGINE_STATUS_BOT_PATH="$1"
_cached_status() { printf '{"podkop_variant":"%s"}\n' "${MOCK_VARIANT:-unknown}"; }
bot_is_running() { return 1; }
awk() {
	case "$*" in
		*"/proc/4242/status") printf '%s\n' 37 ;;
		*"/proc/"*"/status") printf 'unexpected PID\n' >&2; return 9 ;;
		*) command awk "$@" ;;
	esac
}
pidof() { printf 'global pidof must never run\n' >&2; echo 777; }
ubus() {
	case "$*" in
		*'call podkop run'*get_system_info*) printf '%s\n' "${MOCK_UBUS:-}" ;;
		*) return 1 ;;
	esac
}
opkg() { printf '%s\n' "${MOCK_OPKG:-}"; }
apk() { printf '%s\n' "${MOCK_APK:-}"; }
_json_str() { jq -cn --arg s "$1" '$s'; }
SETUP
run() {
	sh -c '. "$2"; . "$3"; "$4"' sh "$1" "$T/setup.sh" "$T/functions.sh" "$2"
}
assert() { jq -e "$1" >/dev/null; }
export BAD_BOT_RUN="$T/old-bot-was-run"
# PID and RSS are the daemon's, but its existence doesn't mean the engine runs.
export MOCK_STATE='{"state":"running","process_state":"running","pid":4242,"variant":"podkop-exp","service":"podkop"}'
run "$T/fake-bot" method_resources | assert '.singbox | .state == "running" and .running == true and .rss_mb == 37 and .pids == [4242] and .variant == "podkop-exp"'
MOCK_STATE='{"state":"stopped","process_state":"running","pid":4242,"variant":"podkop-exp","service":"podkop"}' \
	run "$T/fake-bot" method_resources | assert '.singbox | .state == "stopped" and .running == false and .rss_mb == 37'
MOCK_STATE='{"state":"unknown","process_state":"running","pid":4242,"variant":"podkop-exp","service":"podkop"}' \
	run "$T/fake-bot" method_resources | assert '.singbox | .state == "unknown" and .running == null and .rss_mb == 37'
MOCK_STATE='{"state":"running","process_state":"running","pid":"4242","variant":"podkop-exp","service":"podkop"}' \
	run "$T/fake-bot" method_resources | assert '.singbox | .pids == [] and .rss_mb == null'
MOCK_FAILED=1 run "$T/fake-bot" method_resources | assert '.singbox | .state == "unknown" and .running == null and .rss_mb == null and .pids == []'
MOCK_STATE='{"state":"something","process_state":"running","pid":4242}' \
	run "$T/fake-bot" method_resources | assert '.singbox | .state == "unknown" and .pids == []'
run "$T/old-bot" method_resources | assert '.singbox | .state == "unknown" and .pids == []'
[ ! -e "$BAD_BOT_RUN" ]
MOCK_STATE='{"state":"running","process_state":"running","pid":4242,"variant":"podkop","service":"sing-box"}' \
	run "$T/fake-bot" method_resources | assert '.singbox | .running == true and .service == "sing-box" and .rss_mb == 37'
MOCK_STATE='{"state":"stopped","process_state":"stopped","pid":4242,"variant":"podkop","service":"sing-box"}' \
	run "$T/fake-bot" method_resources | assert '.singbox | .running == false and .pids == [] and .rss_mb == null'

export MOCK_OPKG='podkop-exp - 0.8.14-r1'
export MOCK_UBUS='{"code":0,"stdout":"{\"sing_box_version\":\"1.14.4-pdk-4078a4f6ea14\",\"engine\":\"sing-box 1.14.4, podkop-engine r25, slim (4078a4f6ea14)\"}"}'
run "$T/fake-bot" method_singbox_info | assert '.package == "podkop-exp" and .flavour == "embedded" and .version == "1.14.4-pdk-4078a4f6ea14" and .package_version == "0.8.14-r1" and (.engine | contains("r25"))'
MOCK_OPKG='podkop-exp - 0.8.21-r1' \
MOCK_UBUS='{"code":0,"stdout":"{\"sing_box_version\":\"1.14.4-pdk-209086dbd08a\",\"engine\":\"sing-box 1.14.4, podkop-engine r28, slim (209086dbd08a)\"}"}' \
	run "$T/fake-bot" method_singbox_info | assert '.package == "podkop-exp" and .version == "1.14.4-pdk-209086dbd08a" and (.engine | contains("r28"))'
MOCK_OPKG='' MOCK_VARIANT=podkop-exp MOCK_UBUS='{"code":1,"stdout":"{\"engine\":\"bad\"}"}' \
	run "$T/fake-bot" method_singbox_info | assert '.package == "podkop-exp" and .version == "unknown" and .engine == ""'
MOCK_OPKG='podkop-engine - 1.14.4-r28' \
	run "$T/fake-bot" method_singbox_info | assert '.package == "podkop-engine" and .flavour == "slim" and .package_version == "1.14.4-r28"'
MOCK_OPKG='' MOCK_APK='podkop-engine-full-1.14.4-r28' \
	run "$T/fake-bot" method_singbox_info | assert '.package == "podkop-engine-full" and .flavour == "full" and .package_version == "1.14.4-r28"'

node - <<'JS'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dir = 'root/www/luci-static/resources/view/podkop-bot/';
const view = new Function('view', 'rpc', '_', 'E', fs.readFileSync(dir + 'overview.js', 'utf8'))(
	{extend: methods => methods}, {declare: () => {}}, x => x, (tag, attrs, children) => ({tag, attrs, children})
);
const state = sb => view.buildSingboxResource(sb).children[1].children;
assert.match(state({state:'running', process_state:'running', pid:4242, variant:'podkop-exp', rss_mb:37}), /работает · PID демона 4242 · RSS демона 37 MB/);
assert.match(state({state:'stopped', process_state:'running', pid:4242, variant:'podkop-exp', rss_mb:37}), /не запущен · PID демона 4242/);
assert.equal(state({state:'unknown'}), 'не удалось определить');
assert.equal(state({running:false}), 'не удалось определить'); // mixed RPC/UI upgrade
assert.equal(state({state:'running', process_state:'running', pid:4242, rss_mb:null}), 'работает · PID 4242');
assert.equal(view.singboxResourceLabel({variant:'podkop-exp'}), 'sing-box (встроенный)');
assert.equal(view.singboxVersionLabel({ok:true, version:'unknown', flavour:'embedded'}), 'версия неизвестна · встроенный');
assert.equal(view.singboxVersionLabel({ok:true, engine:'r28', flavour:'embedded'}), 'r28 · встроенный');
assert.equal(view.singboxVersionLabel({ok:true, version:'1.14.4-pdk-r28', flavour:'full', package:'podkop-engine-full'}), '1.14.4-pdk-r28 · full · podkop-engine-full');
for (const name of ['overview.js','overview-async.js','overview-state.js']) {
	const source = fs.readFileSync(dir + name, 'utf8');
	assert.ok(source.includes('this.buildSingboxResource(sb)') && source.includes('this.singboxResourceLabel(sb)'));
}
JS
echo "BearGuard engine state, owned RSS, and versions: OK"
