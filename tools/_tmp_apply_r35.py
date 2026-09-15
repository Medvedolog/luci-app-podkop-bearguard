#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path('.')

def read(p):
    return (ROOT / p).read_text()

def write(p, s):
    path = ROOT / p
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(s)

def once(s, old, new, label):
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected one anchor, found {n}')
    return s.replace(old, new, 1)

# ---------------------------------------------------------------------------
# Transport: no network probe on render/mutation; manual probe has inline
# progress and a real in-flight mutex; WARP button opens the Revolver page.
# ---------------------------------------------------------------------------
p = 'root/www/luci-static/resources/view/podkop-bot/transport.js'
s = read(p)
s = once(s,
    "\t\tvar ttl=600, stale=!_chainCheckedAt||(Math.floor(Date.now()/1000)-_chainCheckedAt)>ttl;\n\t\tif(!_chainTestedThisSession||stale)window.setTimeout(function(){self.testFullChain();},60);else window.setTimeout(function(){self.applyChainCache();},60);",
    "\t\t/* Opening the page must be side-effect free: show the last cached result,\n\t\t * but never start Telegram probes without an explicit button click. */\n\t\twindow.setTimeout(function(){self.applyChainCache();},60);",
    'transport render auto probe')
s = once(s,
    "\t\t\tif(mutated)window.setTimeout(function(){self.testFullChain();},60);else window.setTimeout(function(){self.applyChainCache();},60);",
    "\t\t\t/* A config mutation invalidates the cache above, but does not implicitly\n\t\t\t * generate network traffic. The operator starts a full probe explicitly. */\n\t\t\twindow.setTimeout(function(){self.applyChainCache();},60);",
    'transport mutation auto probe')
s = once(s,
    "'href':L.url('admin/services/podkop-bot/transport/warpscout')",
    "'href':L.url('admin/services/podkop-bot/transport/warp-revolver')",
    'WARP button target')

start = s.index('\ttestFullChain:function(){')
end = s.index('\tapplyChainCache:function()', start)
new_test = r'''\ttestFullChain:function(){
\t\tvar self=this;
\t\tif(this._chainProbePromise)return this._chainProbePromise;
\t\tvar seq=this.tiers.filter(function(t){return t.endpoint&&t.endpoint!==''&&!t._noProbe;}),i=0;
\t\tif(this._testAllBtn)this._testAllBtn.disabled=true;
\t\tfunction progress(t){
\t\t\tif(!self._chainMeta)return;
\t\t\tvar name=t?(t.name||t.id||''):_('завершение');
\t\t\tdom.content(self._chainMeta,_('Проверка цепочки: ')+String(Math.min(i+1,seq.length))+' / '+String(seq.length)+(name?' · '+name:''));
\t\t}
\t\tfunction finish(){
\t\t\t_chainCheckedAt=Math.floor(Date.now()/1000);_chainTestedThisSession=true;saveChainProbeCache();
\t\t\tself.renderChainMeta();if(self._testAllBtn)self._testAllBtn.disabled=false;self._chainProbePromise=null;
\t\t}
\t\tfunction fail(){
\t\t\tif(self._chainMeta)dom.content(self._chainMeta,_('Проверка цепочки прервана. Нажмите «Проверить всю цепочку», чтобы повторить.'));
\t\t\tif(self._testAllBtn)self._testAllBtn.disabled=false;self._chainProbePromise=null;
\t\t}
\t\tfunction next(){
\t\t\tif(i>=seq.length){finish();return Promise.resolve();}
\t\t\tvar t=seq[i];progress(t);return self.probeOne(t).then(function(){i++;return next();});
\t\t}
\t\tif(!seq.length){finish();return Promise.resolve();}
\t\tthis._chainProbePromise=Promise.resolve().then(next).catch(function(e){fail();throw e;});
\t\treturn this._chainProbePromise;
\t},
'''.replace('\\t', '\t')
s = s[:start] + new_test + s[end:]

old = "\t\t\tif(rs.running){parts.push(_('WARP Rescue SOCKS активен'));if(rs.endpoint)parts.push(rs.endpoint);}else parts.push(_('WARP Rescue SOCKS остановлен'));\n\t\t\tt.push({id:'warp_rescue'"
new = "\t\t\tif(rs.running){parts.push(_('WARP Rescue SOCKS активен'));if(rs.endpoint)parts.push(rs.endpoint);}else parts.push(_('WARP Rescue SOCKS остановлен'));\n\t\t\tparts.push(_('автозапуск/самовосстановление: ')+(rs.autostart?_('ВКЛ'):_('ВЫКЛ')));\n\t\t\tparts.push(_('автоперезарядка: ')+(rs.auto?_('ВКЛ'):_('ВЫКЛ')));\n\t\t\tt.push({id:'warp_rescue'"
s = once(s, old, new, 'WARP automation status')
write(p, s)

# ---------------------------------------------------------------------------
# Bearhole UI: clearly separate local HWELP auth from upstream proxy auth and
# render service-resource results as cards on narrow screens.
# ---------------------------------------------------------------------------
p = 'root/www/luci-static/resources/view/podkop-bot/bearhole.js'
s = read(p)
start = s.index('\tproxySettings:function(st,isBusy){')
end = s.index('\n\trenderBody:function(){', start)
proxy_fn = r'''\tproxySettings:function(st,isBusy){
\t\tvar self=this;
\t\tvar port=E('input',{'type':'number','min':'1024','max':'65535','step':'1','value':String(st.port||1066),'disabled':isBusy?'disabled':null,'style':'width:7.5em;'});
\t\tvar auth=E('input',{'type':'checkbox','checked':st.auth_enabled?'checked':null,'disabled':isBusy?'disabled':null});
\t\tvar user=E('input',{'type':'text','value':st.auth_user||'','disabled':isBusy?'disabled':null,'autocomplete':'username','style':'max-width:18em;'});
\t\tvar pass=E('input',{'type':'password','value':'','placeholder':st.auth_configured?_('оставьте пустым, чтобы не менять'):_('пароль'),'disabled':isBusy?'disabled':null,'autocomplete':'new-password','style':'max-width:18em;'});
\t\tvar authFields=E('div',{'style':'display:'+(st.auth_enabled?'block':'none')+';margin-top:.5em;'},[row(_('Локальный логин'),user),row(_('Локальный пароль'),pass)]);
\t\tauth.addEventListener('change',function(){authFields.style.display=auth.checked?'block':'none';});
\t\tvar localAuth=E('details',{'style':'margin:.7em 0;padding:.55em .7em;border:1px solid rgba(127,127,127,.16);border-radius:8px;'},[
\t\t\tE('summary',{'style':'cursor:pointer;font-weight:600;'},_('Локальная авторизация hwelp (обычно не нужна)')),
\t\t\tE('p',{'class':'pb-hint-90','style':'margin:.55em 0;'},_('Это защита ВХОДА в hwelp на 127.0.0.1. Она не относится к логину/паролю вышестоящего SOCKS/HTTP proxy. Так как hwelp слушает только loopback, обычно эту опцию можно оставить выключенной.')),
\t\t\trow(_('Требовать авторизацию'),E('label',{'style':'display:inline-flex;align-items:center;gap:.45em;'},[auth,E('span',{},_('у программ самого OpenWrt'))])),authFields
\t\t]);
\t\treturn E('details',{'id':'bearhole-proxy-settings','open':this.proxyOpen?'':null,'style':'margin:.7em 0 .3em;'},[
\t\t\tE('summary',{'style':'cursor:pointer;font-weight:600;'},_('Настройки локального hwelp proxy')),
\t\t\tE('div',{'style':'margin-top:.65em;max-width:720px;'},[
\t\t\t\trow(_('Адрес входа'),E('code',{},'127.0.0.1')),
\t\t\t\trow(_('Порт входа'),port),
\t\t\t\tE('p',{'class':'pb-hint-90','style':'margin:.55em 0;'},_('Адрес намеренно фиксирован на loopback. Порт меняется только при конфликте.')),
\t\t\t\tlocalAuth,
\t\t\t\tE('div',{'style':'margin:.8em 0;padding:.65em .75em;border-left:3px solid #4d8fd8;background:rgba(77,143,216,.06);'},[
\t\t\t\t\tE('strong',{},_('Авторизация на вышестоящих прокси')),
\t\t\t\t\tE('div',{'class':'pb-hint-90','style':'margin-top:.35em;'},_('Логин и пароль SOCKS5/HTTP задаются в самой записи маршрута. hwelp получает их из общего registry и использует при подключении к upstream proxy.')),
\t\t\t\t\tE('a',{'class':'cbi-button','style':'margin-top:.55em;','href':L.url('admin/services/podkop-bot/transport/main')},_('Открыть «Цепочку прокси»'))
\t\t\t\t]),
\t\t\t\tE('button',{'class':'cbi-button cbi-button-action','disabled':isBusy?'disabled':null,'click':function(){return self.saveProxy(port,auth,user,pass);}},_('Применить'))
\t\t\t])
\t\t]);
\t},
'''.replace('\\t','\t')
s = s[:start] + proxy_fn + s[end:]

start = s.index('\tresultsTable:function(items){')
end = s.index('\n\thandleSave:null', start)
results_fn = r'''\tresultsTable:function(items){
\t\tif(!items.length)return E('p',{'class':'pb-hint-90'},_('Свежей проверки ещё нет. Нажмите «🐻 Запустить Bearhole» — при первом запуске он сам проверит всю цепочку.'));
\t\tvar narrow=!!(window.matchMedia&&window.matchMedia('(max-width: 720px)').matches);
\t\tif(narrow){
\t\t\tfunction res(label,val,title){return E('div',{'style':'display:flex;align-items:center;justify-content:space-between;gap:.45em;min-width:0;padding:.25em .35em;border-radius:6px;background:rgba(127,127,127,.06);'},[E('span',{'title':title||label,'style':'font-size:86%;white-space:nowrap;'},label),q(val)]);}
\t\t\treturn E('div',{},items.map(function(x){return E('div',{'style':'padding:.7em .15em;border-top:1px solid rgba(127,127,127,.16);'},[
\t\t\t\tE('div',{'style':'display:flex;align-items:flex-start;justify-content:space-between;gap:.6em;'},[E('strong',{'style':'min-width:0;overflow-wrap:anywhere;'},x.label||x.id),routeStatus(x.status)]),
\t\t\t\tE('div',{'class':'pb-hint-90','style':'font-family:monospace;overflow-wrap:anywhere;margin:.2em 0 .55em;'},x.endpoint||''),
\t\t\t\tE('div',{'style':'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.35em;'},[
\t\t\t\t\tres('GitHub',x.github_core,'github.com'),res('Raw',x.github_raw,'raw.githubusercontent.com'),res('API',x.github_api,'api.github.com'),
\t\t\t\t\tres(_('Архив'),x.github_codeload,'codeload.github.com'),res(_('Релизы'),x.github_assets,_('GitHub release assets')),res('Feeds',x.openwrt_feeds,_('Репозитории OpenWrt'))
\t\t\t\t]),
\t\t\t\tE('div',{'class':'pb-hint-90','style':'text-align:right;margin-top:.45em;'},_('Проверено: ')+age(x.checked_at))
\t\t\t]);}));
\t\t}
\t\tvar rows=items.map(function(x){return E('tr',{},[
\t\t\tE('td',{},[E('strong',{},x.label||x.id),E('div',{'class':'pb-hint-90','style':'overflow-wrap:anywhere;'},x.endpoint||'')]),
\t\t\tE('td',{'style':'text-align:center;'},[routeStatus(x.status)]),E('td',{'style':'text-align:center;'},[q(x.github_core)]),E('td',{'style':'text-align:center;'},[q(x.github_raw)]),E('td',{'style':'text-align:center;'},[q(x.github_api)]),E('td',{'style':'text-align:center;'},[q(x.github_codeload)]),E('td',{'style':'text-align:center;'},[q(x.github_assets)]),E('td',{'style':'text-align:center;'},[q(x.openwrt_feeds)]),E('td',{'style':'white-space:nowrap;'},age(x.checked_at))
\t\t]);});
\t\tfunction th(label,title){return E('th',{'title':title||label,'style':'white-space:nowrap;text-align:center;'},label);}
\t\treturn E('div',{'style':'overflow-x:auto;'},[E('table',{'class':'table','style':'min-width:760px;'},[
\t\t\tE('thead',{},[E('tr',{},[E('th',{'style':'text-align:left;'},_('Маршрут')),th(_('Статус'),_('Итоговая пригодность маршрута')),th('GitHub',_('github.com')),th('Raw',_('raw.githubusercontent.com')),th('API',_('api.github.com')),th(_('Архив'),_('codeload.github.com')),th(_('Релизы'),_('Файлы GitHub Releases и redirect-хосты')),th('Feeds',_('Репозитории OpenWrt')),E('th',{},_('Проверено'))])]),E('tbody',{},rows)
\t\t])]);
\t},
'''.replace('\\t','\t')
s = s[:start] + results_fn + s[end:]
write(p, s)

# ---------------------------------------------------------------------------
# WARP Revolver: make rescue automation impossible to miss.
# ---------------------------------------------------------------------------
p = 'root/www/luci-static/resources/view/podkop-bot/warpscout-rescue.js'
s = read(p)
old = "row(_('Автовосстановление WARP Rescue'),autostart),row(_('Автоперезарядка при исчерпании магазина'),auto),\n\t\t\t\tE('p',{'class':'pb-hint-90'},_('Автовосстановление запускает Rescue после загрузки роутера и поднимает его снова, если SOCKS-процесс упал или не восстановился после тестового WARP. Ручная кнопка «Остановить WARP» выключает Rescue и не даёт watchdog запускать его снова.')),\n\t\t\t\tE('p',{'class':'pb-hint-90'},_('Автоперезарядка нужна, когда сохранённые VALID WARP-узлы перестали работать: выполняется новый поиск, проверка Telegram API и сбор магазина.'))"
new = "E('div',{'style':'margin:.8em 0;padding:.7em .8em;border:1px solid rgba(127,127,127,.18);border-radius:8px;'},[\n\t\t\t\t\tE('h4',{'style':'margin:.05em 0 .55em;'},_('Автоматика Rescue')),\n\t\t\t\t\trow(_('Автозапуск и самовосстановление'),E('label',{'style':'display:inline-flex;align-items:center;gap:.5em;font-weight:600;'},[autostart,E('span',{},_('Включить'))])),\n\t\t\t\t\tE('p',{'class':'pb-hint-90','style':'margin:.25em 0 .65em;'},_('Поднимает WARP Rescue после загрузки роутера и восстанавливает SOCKS, если он упал. Ручная кнопка «Остановить WARP» отключает Rescue и запрещает watchdog поднимать его снова.')),\n\t\t\t\t\trow(_('Автоперезарядка магазина'),E('label',{'style':'display:inline-flex;align-items:center;gap:.5em;font-weight:600;'},[auto,E('span',{},_('Включить'))])),\n\t\t\t\t\tE('p',{'class':'pb-hint-90','style':'margin:.25em 0 0;'},_('Когда сохранённые VALID WARP-узлы исчерпаны, автоматически выполняет новый поиск, Telegram qualification и собирает магазин заново.'))\n\t\t\t\t])"
s = once(s, old, new, 'Revolver automation block')
write(p, s)

# ---------------------------------------------------------------------------
# Upgrade scripts: keep Bearhole config user-owned (no .opkg conflict) and
# register old procd services before the old package prerm attempts to stop them.
# ---------------------------------------------------------------------------
preinst = r'''#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0

# Preserve the user-owned Bearhole UCI before the old package is removed.
if [ -f /etc/config/podkop_bearhole ]; then
\tcp -p /etc/config/podkop_bearhole /tmp/podkop_bearhole.preupgrade 2>/dev/null || true
fi

# opkg's generated prerm calls `service stop`. rc.common/procd emits a visible
# `service delete ... Not found` when a disabled service has never been
# registered. Register it first; the subsequent old-prerm stop is then quiet.
for _svc in podkop-bearhole podkop-warp-rescue; do
\t[ -x "/etc/init.d/$_svc" ] || continue
\tif ! ubus call service list "{\"name\":\"$_svc\"}" 2>/dev/null | grep -q "\"$_svc\""; then
\t\t"/etc/init.d/$_svc" start >/dev/null 2>&1 || true
\tfi
done
exit 0
'''.replace('\\t','\t')
write('scripts/preinst', preinst)
(ROOT/'scripts/preinst').chmod(0o755)

post = read('scripts/postinst')
# Replace the whole script: it is short and an upgrade hook should be explicit.
post = r'''#!/bin/sh
[ -n "${IPKG_INSTROOT}" ] && exit 0

# Bearhole UCI is user-owned rather than a package conffile. Restore a backup
# made by preinst if an older package manager removed/renamed it, then create
# only missing defaults. Never overwrite operator settings.
if [ ! -f /etc/config/podkop_bearhole ] && [ -f /tmp/podkop_bearhole.preupgrade ]; then
\tcp -p /tmp/podkop_bearhole.preupgrade /etc/config/podkop_bearhole 2>/dev/null || true
fi
uci -q get podkop_bearhole.main >/dev/null 2>&1 || uci -q set podkop_bearhole.main=bearhole
uci -q get podkop_bearhole.main.enabled >/dev/null 2>&1 || uci -q set podkop_bearhole.main.enabled=0
uci -q get podkop_bearhole.main.policy >/dev/null 2>&1 || uci -q set podkop_bearhole.main.policy=auto
uci -q get podkop_bearhole.main.port >/dev/null 2>&1 || uci -q set podkop_bearhole.main.port=1066
uci -q get podkop_bearhole.main.auth_enabled >/dev/null 2>&1 || uci -q set podkop_bearhole.main.auth_enabled=0
uci -q commit podkop_bearhole >/dev/null 2>&1 || true
rm -f /tmp/podkop_bearhole.preupgrade /etc/config/podkop_bearhole-opkg 2>/dev/null || true

for _f in \
\t/usr/libexec/rpcd/podkop_bot \
\t/usr/libexec/rpcd/podkop_bot_bearhole \
\t/usr/lib/podkop_bot/install.sh \
\t/usr/lib/podkop_bot/podkop_bot \
\t/usr/lib/podkop_bot/podkop_bot_init \
\t/usr/lib/podkop_bot/bearhole.sh \
\t/usr/lib/podkop_bot/warpscout-rescue-watchdog \
\t/etc/init.d/podkop-bearhole \
\t/etc/init.d/podkop-warp-rescue
do
\tchmod +x "$_f" 2>/dev/null || true
done

/etc/init.d/rpcd restart >/dev/null 2>&1 || true

# The watchdog itself is cheap. Whether it actually starts Rescue is controlled
# by rescue_autostart in warpscout.conf.
if [ -x /etc/init.d/podkop-warp-rescue ]; then
\t/etc/init.d/podkop-warp-rescue enable >/dev/null 2>&1 || true
\t/etc/init.d/podkop-warp-rescue start >/dev/null 2>&1 || true
fi

# If Bearhole was enabled before upgrade, reactivate it through the control
# plane, not by merely spawning HWELP: qualification and gateway verification
# must run before the system proxy is considered ready.
if [ "$(uci -q get podkop_bearhole.main.enabled 2>/dev/null)" = "1" ] && [ -x /usr/bin/hwelp-proxy ]; then
\t/etc/init.d/podkop-bearhole enable >/dev/null 2>&1 || true
\tubus call podkop_bot_bearhole start '{}' >/dev/null 2>&1 || /etc/init.d/podkop-bearhole start >/dev/null 2>&1 || true
fi

rm -f /tmp/luci-indexcache* 2>/dev/null || true
rm -rf /tmp/luci-modulecache 2>/dev/null || true
exit 0
'''.replace('\\t','\t')
write('scripts/postinst', post)
(ROOT/'scripts/postinst').chmod(0o755)

# Config is persistent/user-owned; shipping it as a conffile guarantees an
# -opkg collision as soon as the user changes port/auth/enabled.
cfg = ROOT/'root/etc/config/podkop_bearhole'
if cfg.exists(): cfg.unlink()

p = 'tools/stage.sh'
s = read(p)
s = once(s, 'for s in postinst postrm; do', 'for s in preinst postinst postrm; do', 'stage maintainer scripts')
write(p, s)

p = 'tools/check-package.sh'
s = read(p)
s = once(s, '    ./etc/config/podkop_bearhole \\\n', '', 'remove config payload assertion')
old = '''grep -qx '/etc/config/podkop_bearhole' "$work/control/conffiles" || {
    echo "Bearhole conffile is not declared" >&2; exit 1;
}
'''
new = '''[ ! -e "$work/data/etc/config/podkop_bearhole" ] || {
    echo "Bearhole config must be user-owned, not packaged" >&2; exit 1;
}
if [ -f "$work/control/conffiles" ] && grep -qx '/etc/config/podkop_bearhole' "$work/control/conffiles"; then
    echo "Bearhole config unexpectedly declared as package conffile" >&2; exit 1
fi
'''
s = once(s, old, new, 'config ownership assertion')
s = once(s,
    '[ -x "$work/control/postinst" ] || { echo "postinst missing/not executable" >&2; exit 1; }',
    '[ -x "$work/control/preinst" ] || { echo "preinst missing/not executable" >&2; exit 1; }\n[ -x "$work/control/postinst" ] || { echo "postinst missing/not executable" >&2; exit 1; }',
    'preinst assertion')
write(p, s)

# Infinite HWELP respawn: never leave system proxy pointing at a deliberately
# abandoned crashed listener. A later watchdog can still fail-closed explicitly.
p = 'root/etc/init.d/podkop-bearhole'
s = read(p)
s = once(s, 'procd_set_param respawn 3600 5 5', 'procd_set_param respawn 3600 5 0', 'HWELP respawn')
write(p, s)

# Package revision.
p = 'Makefile'
s = read(p)
s = re.sub(r'^PKG_RELEASE:=\d+$', 'PKG_RELEASE:=35', s, count=1, flags=re.M)
if 'PKG_RELEASE:=35' not in s: raise SystemExit('package release bump failed')
write(p, s)

# Stale failed one-shot patcher from the previous attempt must not stay in dev.
stale = ROOT/'tools/apply-bearhole-hardening.py'
if stale.exists(): stale.unlink()

print('r35 patch applied')
