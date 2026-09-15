from pathlib import Path

p=Path('scripts/postinst')
s=p.read_text()
old='''if [ "$(uci -q get podkop_bearhole.main.enabled 2>/dev/null)" = "1" ] && [ -x /usr/bin/hwelp-proxy ]; then
\t/etc/init.d/podkop-bearhole enable >/dev/null 2>&1 || true
\tubus call podkop_bot_bearhole start '{}' >/dev/null 2>&1 || /etc/init.d/podkop-bearhole start >/dev/null 2>&1 || true
fi
'''
new='''if [ "$(uci -q get podkop_bearhole.main.enabled 2>/dev/null)" = "1" ] && [ -x /usr/bin/hwelp-proxy ]; then
\t/etc/init.d/podkop-bearhole enable >/dev/null 2>&1 || true
\tubus call podkop_bot_bearhole start '{}' >/dev/null 2>&1 || /etc/init.d/podkop-bearhole start >/dev/null 2>&1 || true
else
\t# Upgrade invariant: UCI disabled means no stale HWELP instance and no
\t# system proxy files left from the replaced package.
\t/etc/init.d/podkop-bearhole stop >/dev/null 2>&1 || true
\t/etc/init.d/podkop-bearhole disable >/dev/null 2>&1 || true
\t/usr/lib/podkop_bot/bearhole.sh system-off >/dev/null 2>&1 || true
fi
'''
if old not in s: raise SystemExit('postinst anchor not found')
p.write_text(s.replace(old,new,1))

p=Path('root/usr/lib/podkop_bot/bearhole.sh')
s=p.read_text()
old='''    _system=false; [ -f /etc/profile.d/99-podkop-bearhole.sh ]&&_system=true; _installed=false; [ -x "$HWELP" ]&&_installed=true; _ver=$(bh_hwelp_version); _port=$(bh_port); _gw=$(bh_gateway)
    _auth=false; [ "$(bh_cfg_get auth_enabled 0)" = 1 ]&&_auth=true; _auth_user=$(bh_auth_user); _auth_configured=false; [ -n "$_auth_user" ]&&[ -n "$(bh_auth_pass)" ]&&_auth_configured=true
    printf '{"ok":true,"enabled":%s,"running":%s,"state":%s,"reason":%s,"updated_at":%s,"gateway":%s,"port":%s,"route_id":%s,"route_label":%s,"system_applied":%s,"valid_routes":%s,"degraded_routes":%s,"probing":%s,"pid":%s,"hwelp_rss_mb":%s,"hwelp_installed":%s,"hwelp_version":%s,"auth_enabled":%s,"auth_user":%s,"auth_configured":%s}\\n' "$_enj" "$_running" "$(bh_json_str "$_state")" "$(bh_json_str "$_reason")" "$_upd" "$(bh_json_str "$_gw")" "$_port" "$(bh_json_str "$_cur_id")" "$(bh_json_str "$_cur_label")" "$_system" "${_valid:-0}" "${_degraded:-0}" "$([ -d "$BH_LOCK" ]&&echo true||echo false)" "$_pid" "$_rss" "$_installed" "$(bh_json_str "$_ver")" "$_auth" "$(bh_json_str "$_auth_user")" "$_auth_configured"
'''
new='''    _system=false; [ -f /etc/profile.d/99-podkop-bearhole.sh ]&&_system=true; _installed=false; [ -x "$HWELP" ]&&_installed=true; _ver=$(bh_hwelp_version); _port=$(bh_port); _gw=$(bh_gateway)
    _env_hook=false; grep -qsF "$BH_BEGIN" /etc/environment 2>/dev/null && _env_hook=true
    _curl_hook=false; grep -qsF "$BH_BEGIN" /root/.curlrc 2>/dev/null && _curl_hook=true
    _wget_hook=false; grep -qsF "$BH_BEGIN" /root/.wgetrc 2>/dev/null && _wget_hook=true
    _opkg_hook=false; [ -f /etc/opkg/99-podkop-bearhole.conf ] && _opkg_hook=true
    _pkg=none; command -v apk >/dev/null 2>&1 && _pkg=apk; command -v opkg >/dev/null 2>&1 && _pkg=opkg
    _auth=false; [ "$(bh_cfg_get auth_enabled 0)" = 1 ]&&_auth=true; _auth_user=$(bh_auth_user); _auth_configured=false; [ -n "$_auth_user" ]&&[ -n "$(bh_auth_pass)" ]&&_auth_configured=true
    printf '{"ok":true,"enabled":%s,"running":%s,"state":%s,"reason":%s,"updated_at":%s,"gateway":%s,"port":%s,"route_id":%s,"route_label":%s,"system_applied":%s,"env_hook":%s,"curl_hook":%s,"wget_hook":%s,"opkg_hook":%s,"package_manager":%s,"valid_routes":%s,"degraded_routes":%s,"probing":%s,"pid":%s,"hwelp_rss_mb":%s,"hwelp_installed":%s,"hwelp_version":%s,"auth_enabled":%s,"auth_user":%s,"auth_configured":%s}\\n' "$_enj" "$_running" "$(bh_json_str "$_state")" "$(bh_json_str "$_reason")" "$_upd" "$(bh_json_str "$_gw")" "$_port" "$(bh_json_str "$_cur_id")" "$(bh_json_str "$_cur_label")" "$_system" "$_env_hook" "$_curl_hook" "$_wget_hook" "$_opkg_hook" "$(bh_json_str "$_pkg")" "${_valid:-0}" "${_degraded:-0}" "$([ -d "$BH_LOCK" ]&&echo true||echo false)" "$_pid" "$_rss" "$_installed" "$(bh_json_str "$_ver")" "$_auth" "$(bh_json_str "$_auth_user")" "$_auth_configured"
'''
if old not in s: raise SystemExit('bearhole status anchor not found')
p.write_text(s.replace(old,new,1))

p=Path('root/www/luci-static/resources/view/podkop-bot/bearhole.js')
s=p.read_text()
old="function stateNode(st){if(st.probing)return dot('yellow',_('Проверяю маршруты'));if(st.state==='verifying')return dot('yellow',_('Проверяю локальный шлюз'));if(st.starting)return dot('yellow',_('Запускается'));if(verified(st))return dot('green',_('Работает'));if(st.state==='failed')return dot('red',reasonText(st.reason));if(st.enabled&&!st.running)return dot('red',_('Шлюз не запущен'));return dot('grey',_('Выключен'));}"
new="function stateNode(st){if(!st.enabled&&st.running)return dot('red',_('Рассинхронизация: Bearhole выключен, hwelp ещё запущен'));if(st.probing)return dot('yellow',_('Проверяю маршруты'));if(st.state==='verifying')return dot('yellow',_('Проверяю локальный шлюз'));if(st.starting)return dot('yellow',_('Запускается'));if(verified(st))return dot('green',_('Работает'));if(st.state==='failed')return dot('red',reasonText(st.reason));if(st.enabled&&!st.running)return dot('red',_('Шлюз не запущен'));return dot('grey',_('Выключен'));}"
if old not in s: raise SystemExit('stateNode anchor not found')
s=s.replace(old,new,1)
anchor="""\t\tvar localProxy=E('span',{},[E('code',{},st.gateway||('http://127.0.0.1:'+(st.port||1066))),st.auth_enabled?E('span',{'style':'margin-left:.55em;'},dot('green',_('с авторизацией'))):E('span',{})]);
\t\tvar statusCard=card(_('OpenWrt Bearhole'),[
"""
replacement="""\t\tvar localProxy=E('span',{},[E('code',{},st.gateway||('http://127.0.0.1:'+(st.port||1066))),st.auth_enabled?E('span',{'style':'margin-left:.55em;'},dot('green',_('с авторизацией'))):E('span',{})]);
\t\tvar tunnelScope;
\t\tif(st.system_applied&&st.running){
\t\t\tvar hooks=[];
\t\t\tif(st.env_hook)hooks.push('shell / HTTP(S)_PROXY');
\t\t\tif(st.curl_hook)hooks.push('curl');
\t\t\tif(st.wget_hook)hooks.push('wget');
\t\t\tif(st.opkg_hook)hooks.push('opkg');
\t\t\tif(st.package_manager==='apk')hooks.push(_('apk — через HTTP(S)_PROXY окружения'));
\t\t\ttunnelScope=E('div',{'style':'margin:.75em 0;padding:.72em .85em;border-left:3px solid #33a02c;background:rgba(51,160,44,.07);line-height:1.45;'},[
\t\t\t\tE('strong',{},_('Нора включена. Системные загрузки OpenWrt идут через hwelp.')),
\t\t\t\tE('div',{'style':'margin-top:.35em;'},[E('span',{},_('Путь: ')),E('code',{},st.gateway||('http://127.0.0.1:'+(st.port||1066))),E('span',{},' → '+(st.route_label||st.route_id||'—'))]),
\t\t\t\tE('div',{'style':'margin-top:.3em;'},_('Подключено: ')+(hooks.length?hooks.join(' · '):_('системное HTTP(S)-окружение'))),
\t\t\t\tE('div',{'class':'pb-hint-90','style':'margin-top:.25em;'},_('LAN-клиенты через Bearhole не идут. Дополнительно нору используют процессы и службы самого роутера, которые читают HTTP_PROXY / HTTPS_PROXY.'))
\t\t\t]);
\t\t}else if(!st.enabled&&st.running){
\t\t\ttunnelScope=E('div',{'class':'alert-message warning','style':'margin:.75em 0;'},_('Обнаружен старый процесс hwelp при выключенном Bearhole. r51 автоматически приводит состояние к UCI при обновлении пакета.'));
\t\t}else{
\t\t\ttunnelScope=E('div',{'class':'pb-hint-90','style':'margin:.65em 0;'},_('Нора выключена: системные curl/wget/пакетные загрузки не направляются через Bearhole.'));
\t\t}
\t\tvar statusCard=card(_('OpenWrt Bearhole'),[
"""
if anchor not in s: raise SystemExit('localProxy anchor not found')
s=s.replace(anchor,replacement,1)
old="""\t\t\trow(_('Обновлено'),E('span',{},age(st.updated_at))),
\t\t\tthis.proxySettings(st,isBusy),
"""
new="""\t\t\trow(_('Обновлено'),E('span',{},age(st.updated_at))),
\t\t\ttunnelScope,
\t\t\tthis.proxySettings(st,isBusy),
"""
if old not in s: raise SystemExit('status insertion anchor not found')
s=s.replace(old,new,1)
s=s.replace("res(_('Архив'),x.github_codeload,'codeload.github.com'),res(_('Релизы'),x.github_assets,_('GitHub release assets')),res('Feeds',x.openwrt_feeds,_('Репозитории OpenWrt'))", "res(_('Архив'),x.github_codeload,'codeload.github.com'),res('Feeds',x.openwrt_feeds,_('Репозитории OpenWrt'))")
s=s.replace("E('td',{'style':'text-align:center;'},[q(x.github_codeload)]),E('td',{'style':'text-align:center;'},[q(x.github_assets)]),E('td',{'style':'text-align:center;'},[q(x.openwrt_feeds)]),E('td',{'style':'white-space:nowrap;'},age(x.checked_at))", "E('td',{'style':'text-align:center;'},[q(x.github_codeload)]),E('td',{'style':'text-align:center;'},[q(x.openwrt_feeds)]),E('td',{'style':'white-space:nowrap;text-align:right;padding-right:1.2em;'},age(x.checked_at))")
s=s.replace("th(_('Архив'),_('codeload.github.com')),th(_('Релизы'),_('Файлы GitHub Releases и redirect-хосты')),th('Feeds',_('Репозитории OpenWrt')),E('th',{},_('Проверено'))", "th(_('Архив'),_('codeload.github.com')),th('Feeds',_('Репозитории OpenWrt')),E('th',{'style':'text-align:right;padding-right:1.2em;'},_('Проверено'))")
s=s.replace("GitHub, Raw, API, архивы, файлы релизов и настроенные feeds OpenWrt.", "GitHub, Raw, API, архивы и настроенные feeds OpenWrt.")
p.write_text(s)

p=Path('Makefile')
s=p.read_text()
if 'PKG_RELEASE:=50' not in s: raise SystemExit('expected r50')
p.write_text(s.replace('PKG_RELEASE:=50','PKG_RELEASE:=51',1))
