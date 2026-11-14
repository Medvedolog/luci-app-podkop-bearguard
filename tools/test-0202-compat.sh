#!/bin/sh
# 0.20.2 regressions: behaviour that 0.20.1 broke on Forkop 2 / Podkop
# Experimental 0.8.x, checked by running the real functions from the bot and
# rpcd against mocked uci/curl/jq inputs.
set -eu
BOT="${1:-root/usr/lib/podkop_bot/podkop_bot}"
RPCD="${2:-root/usr/libexec/rpcd/podkop_bot}"
[ -f "$BOT" ] && [ -f "$RPCD" ] || { echo "usage: $0 BOT RPCD" >&2; exit 1; }
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT INT TERM
fail() { echo "FAIL: $*" >&2; exit 1; }
fn() { sed -n "/^$1() {/,/^}/p" "$2"; }

# --- 1. xp_menu ("Серверы секции") has no shell-escaped variables -----------
_xp=$(sed -n '/^        xp_menu)$/,/^            ;;$/p' "$BOT")
[ -n "$_xp" ] || fail "xp_menu branch not found"
printf '%s\n' "$_xp" | grep -F '\${' >/dev/null && fail 'xp_menu prints a literal ${...}'
printf '%s\n' "$_xp" | grep -Fq 'server_choice' || fail "xp_menu lost server_choice"

# --- 2. Clash group names: percent-decoding, Forkop 2 PUT guard ------------
fn _clash_tag_decode "$BOT" > "$T/dec.sh"
check_dec() {
    _got=$(sh -c '. "$1"; _clash_tag_decode "$2"' _ "$T/dec.sh" "$1") || _got="<refused>"
    [ "$_got" = "$2" ] || fail "decode '$1' -> '$_got', want '$2'"
}
check_dec main main
check_dec '%D0%9E%D1%81%D0%BD%D0%BE%D0%B2%D0%BD%D0%B0%D1%8F' 'Основная'
check_dec 'My%20VPN' 'My VPN'
check_dec 'main%2Fsub' 'main/sub'
check_dec 'bad%2' '<refused>'
check_dec 'x%0Ay' '<refused>'
check_dec 'x%zzy' '<refused>'
# Guard applies to /proxies/<group> only; /providers/proxies PUT is untouched.
_guard=$(fn clash_request "$BOT" | grep -n 'if \[ "$method" = "PUT" \]' | head -1)
printf '%s' "$_guard" | grep -Fq '${endpoint#/proxies/?}' || fail "PUT guard is not limited to /proxies/<group>"
fn clash_request "$BOT" | grep -F "''|*'%'*) return 1" >/dev/null && fail "PUT guard rejects encoded group names again"

# Every caller encodes with @uri: run the guard path end to end against a mock API.
cat > "$T/env.sh" <<'ENV'
PODKOP_UCI=forkop
CLASH_API=http://127.0.0.1:9090
_forkop_v2() { return 0; }
_podkop_exp_v2() { return 1; }
lan_ipv4() { echo 192.168.1.1; }
uci() { return 1; }
curl() {
    _m=GET _u=""
    while [ $# -gt 0 ]; do case "$1" in -X) _m=$2; shift ;; http*) _u=$1 ;; esac; shift; done
    case "$_m $_u" in
        "GET "*/proxies) printf '%s' "$MOCK_PROXIES" ;;
        "PUT "*) printf '%s\n' "${_u#*9090}" >> "$PUT_LOG"; printf '' ;;
        *) return 7 ;;
    esac
}
ENV
MOCK_PROXIES='{"proxies":{"Основная":{"type":"Selector","all":["Основная/de1","Основная/Авто"]},"Основная/Авто":{"type":"URLTest","all":["Основная/de1"]},"main/fb":{"type":"Fallback","all":["main/a"]}}}'
export MOCK_PROXIES PUT_LOG="$T/put.log"
: > "$PUT_LOG"
fn clash_request "$BOT" > "$T/cr.sh"
run_put() {
    sh -c '. "$1"; . "$2"; . "$3"; clash_request "$4" PUT "$5"' _ "$T/env.sh" "$T/dec.sh" "$T/cr.sh" "$1" "$2" >/dev/null 2>&1
}
_sel=$(printf '%s' 'Основная' | jq -rR '@uri')
run_put "/proxies/$_sel" '{"name":"Основная/de1"}' || fail "PUT to a Cyrillic Selector refused"
_fb=$(printf '%s' 'main/fb' | jq -rR '@uri')
run_put "/proxies/$_fb" '{"name":"main/a"}' || fail "PUT to a nested Fallback refused"
_ut=$(printf '%s' 'Основная/Авто' | jq -rR '@uri')
run_put "/proxies/$_ut" '{"name":"Основная/de1"}' && fail "PUT to URLTest must be refused"
run_put "/proxies/$_sel" '{"name":"чужой"}' && fail "PUT of a non-member must be refused"
run_put "/providers/proxies/main%2Fsub1" '' || fail "subscription refresh PUT blocked"
grep -qx "/proxies/$_sel" "$PUT_LOG" || fail "Selector PUT went to $(cat "$PUT_LOG")"
grep -qx "/proxies/$_fb" "$PUT_LOG" || fail "Fallback PUT not sent"
grep -qx "/providers/proxies/main%2Fsub1" "$PUT_LOG" || fail "provider PUT not sent"

# --- 3. Podkop Experimental rule names (model/names.go) ---------------------
cat > "$T/uci.txt" <<'UCI'
podkop.settings=settings
podkop.settings.config_version='2'
podkop.main=section
podkop.main.label='Germany'
podkop.yt=section
podkop.yt.label='  You   Tube '
podkop.de2=section
podkop.de2.label='Germany'
podkop.plain=section
podkop.it=section
podkop.it.label='it'\''s'
podkop.src1=source
podkop.src1.label='Germany'
UCI
fn _exp_rule_name_awk "$BOT" > "$T/nm.sh"
for pair in main:Germany 'yt:You Tube' 'de2:Germany (de2)' plain:plain "it:it's"; do
    _s=${pair%%:*} _want=${pair#*:}
    _got=$(PODKOP_UCI=podkop sh -c '. "$1"; _exp_rule_name_awk "$2" < "$3"' _ "$T/nm.sh" "$_s" "$T/uci.txt")
    [ "$_got" = "$_want" ] || fail "bot rule name $_s -> '$_got', want '$_want'"
done
fn _sec_clash_tag "$RPCD" > "$T/rt.sh"
cat > "$T/renv.sh" <<ENV
_fk2() { return 1; }
uci() {
    case "\$*" in
        "-q show podkop") cat "$T/uci.txt" ;;
        "-q get podkop.settings.config_version") echo 2 ;;
        *) return 1 ;;
    esac
}
ENV
for pair in main:Germany 'de2:Germany (de2)' plain:plain; do
    _s=${pair%%:*} _want=${pair#*:}
    _got=$(sh -c '. "$1"; . "$2"; _sec_clash_tag podkop "$3" podkop-exp' _ "$T/renv.sh" "$T/rt.sh" "$_s")
    [ "$_got" = "$_want" ] || fail "rpcd rule name $_s -> '$_got', want '$_want'"
done
_got=$(sh -c '. "$1"; . "$2"; _sec_clash_tag podkop main podkop' _ "$T/renv.sh" "$T/rt.sh")
[ "$_got" = main ] || fail "classic Podkop section tag changed: '$_got'"

# --- 4. LuCI reaches the embedded engine's API on loopback ------------------
grep -Fq '[ -z "$_clash_addr" ] && _clash_addr="127.0.0.1:9090"' "$RPCD" || fail "rpcd Clash API default is not loopback"
grep -Fq '[ "$_variant" = podkop-exp ] || _clash_addr=' "$RPCD" || fail "rpcd reads a stale config.json on Podkop Experimental"

# --- 5. urltest_testing_url stays a list ------------------------------------
grep -Fq 'uci add_list "${PODKOP_UCI}.settings.${_key}=${_tu}"' "$BOT" || fail "testing URLs are not written as a list"

# --- 6. No downgrade offer when the bundled bot is newer than main ----------
grep -Fq 'if _ver_is_newer "$remote_ver" "$BOT_VERSION"; then' "$BOT" || fail "update check may offer a downgrade"

echo "0.20.2 Forkop 2 / Podkop Experimental regression checks OK"
