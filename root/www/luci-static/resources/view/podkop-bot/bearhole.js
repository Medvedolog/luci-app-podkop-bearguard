'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callStatus = rpc.declare({ object:'podkop_bot_bearhole', method:'status' });
var callResults = rpc.declare({ object:'podkop_bot_bearhole', method:'results' });
var callStart = rpc.declare({ object:'podkop_bot_bearhole', method:'start' });
var callSetEnabled = rpc.declare({ object:'podkop_bot_bearhole', method:'set_enabled', params:['enabled'] });
var callQualify = rpc.declare({ object:'podkop_bot_bearhole', method:'qualify_start' });
var callLog = rpc.declare({ object:'podkop_bot_bearhole', method:'log', params:['offset'] });

var COLOURS={green:'#33a02c',yellow:'#e8a33d',grey:'#888888',red:'#cc2b2b'};
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:center;gap:.4em;min-width:0;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{'style':'overflow-wrap:anywhere;'},label)]);}
function row(label,val){return E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},label),E('span',{'class':'pb-row-val'},[val])]);}
function card(title,children){return E('div',{'class':'cbi-section pb-card','style':'max-width:900px;'},[E('h3',{'style':'margin-top:0;'},title)].concat(children));}
function pbInjectCss(){if(document.getElementById('pb-css'))return;document.querySelector('head').appendChild(E('link',{'id':'pb-css','rel':'stylesheet','type':'text/css','href':L.resource('css/podkop-bot/podkop-bot.css')}));}
function age(ts){var n=parseInt(ts||0,10);if(!n)return '—';var s=Math.max(0,Math.floor(Date.now()/1000)-n);if(s<60)return _('только что');if(s<3600)return Math.floor(s/60)+_(' мин назад');if(s<86400)return Math.floor(s/3600)+_(' ч назад');return Math.floor(s/86400)+_(' дн назад');}
function reasonText(r){var m={ucode_missing:_('В системе нет ucode.'),proxy_missing:_('Не найден движок HWELP proxy.'),ucode_modules_missing:_('Не установлены ucode-mod-socket, ucode-mod-struct и ucode-mod-uloop.'),gateway_start_failed:_('HWELP proxy не смог открыть 127.0.0.1:1066.'),gateway_check_failed:_('HWELP proxy запустился, но контрольная загрузка через него не прошла.'),no_routes:_('В цепочке нет маршрутов для проверки.'),no_usable_route:_('После проверки не найден рабочий маршрут для системных загрузок.'),route_check_timeout:_('Проверка маршрутов превысила допустимое время.'),uci_enable_failed:_('Не удалось сохранить настройку Bearhole.'),uci_commit_failed:_('Не удалось записать конфигурацию Bearhole.')};return m[r]||r||_('Неизвестная ошибка.');}
function stateNode(st){if(st.probing)return dot('yellow',_('Проверяю маршруты'));if(st.state==='verifying')return dot('yellow',_('Проверяю локальный шлюз'));if(st.starting)return dot('yellow',_('Запускается'));if(st.running&&st.system_applied&&st.state==='ready')return dot('green',_('Работает'));if(st.state==='failed')return dot('red',reasonText(st.reason));if(st.enabled&&!st.running)return dot('red',_('Шлюз не запущен'));return dot('grey',_('Выключен'));}
function hwelpNode(st){var pid=parseInt(st.pid||0,10)||0,s='';if(st.running&&st.state==='ready'&&st.system_applied){s=_('работает');if(pid>0)s+=' · PID '+String(pid);return dot('green',s);}if(st.running){s=(st.probing||st.state==='verifying'||st.starting)?_('запущен, проверяется'):_('запущен');if(pid>0)s+=' · PID '+String(pid);return dot('yellow',s);}if(st.starting)return dot('yellow',_('запускается'));if(st.state==='failed'&&String(st.reason||'').indexOf('gateway')>=0)return dot('red',_('ошибка запуска'));return dot('grey',_('не запущен'));}
function q(v){if(v==='ok')return dot('green',_('доступен'));if(v==='skip')return dot('grey','—');return dot('red',_('нет доступа'));}
function routeStatus(v){if(v==='VALID')return dot('green',_('пригоден'));if(v==='DEGRADED')return dot('yellow',_('частично'));return dot('red',_('не пригоден'));}

return view.extend({
	load:function(){pbInjectCss();return Promise.all([callStatus().catch(function(){return {ok:false};}),callResults().catch(function(){return {items:[]};}),callLog(0).catch(function(){return {chunk:'',offset:0};})]);},
	render:function(data){this.status=data[0]||{};this.results=data[1]||{items:[]};this.logText=(data[2]&&data[2].chunk)||'';this.logOffset=(data[2]&&data[2].offset)||0;this.root=E('div',{});dom.content(this.root,this.renderBody());if(this.status.starting||this.status.probing||this.status.state==='verifying')this.schedulePoll(400);return this.root;},
	refresh:function(){var self=this;return Promise.all([callStatus(),callResults().catch(function(){return {items:[]};}),callLog(this.logOffset||0).catch(function(){return null;})]).then(function(x){self.status=x[0]||{};self.results=x[1]||{items:[]};if(x[2]){self.logOffset=x[2].offset||self.logOffset;if(x[2].chunk)self.logText+=x[2].chunk;}dom.content(self.root,self.renderBody());return self.status;});},
	schedulePoll:function(ms){var self=this;if(this.timer)window.clearTimeout(this.timer);this.timer=window.setTimeout(function(){self.refresh().then(function(st){if(st.starting||st.probing||st.state==='verifying')self.schedulePoll(900);});},ms||900);},
	startBearhole:function(){var self=this;return callStart().then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'start_failed');self.status.starting=true;self.status.state='starting';dom.content(self.root,self.renderBody());self.schedulePoll(250);}).catch(function(e){ui.addNotification(null,E('p',{},_('Bearhole не запущен: ')+reasonText((e&&e.message)||'')),'error');return self.refresh();});},
	stopBearhole:function(){var self=this;return callSetEnabled(false).then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'disable_failed');return self.refresh();}).catch(function(e){ui.addNotification(null,E('p',{},_('Не удалось остановить Bearhole: ')+((e&&e.message)||'?')),'error');});},
	recheck:function(){var self=this;return callQualify().then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'check_failed');return self.refresh();}).then(function(){self.schedulePoll(300);}).catch(function(e){ui.addNotification(null,E('p',{},_('Не удалось запустить проверку маршрутов: ')+reasonText((e&&e.message)||'')),'error');});},
	progressCard:function(st){if(!(st.starting||st.probing||st.state==='verifying'))return E('span',{});var done=parseInt(st.progress_done||0,10)||0,total=parseInt(st.progress_total||0,10)||0,label='';if(st.probing){label=_('Проверяю всю цепочку прокси');if(st.progress_label)label+=': '+st.progress_label;}else if(st.state==='verifying')label=_('Проверяю, что OpenWrt действительно выходит через HWELP proxy');else label=_('Подготавливаю цепочку и запускаю HWELP proxy');var kids=[E('strong',{},label)];if(st.probing&&total>0){kids.push(E('div',{'style':'margin-top:.55em;'},[E('progress',{'max':String(total),'value':String(Math.min(done,total)),'style':'width:100%;max-width:520px;'}),E('span',{'style':'margin-left:.6em;color:#888;'},String(done)+' / '+String(total))]));}return E('div',{'class':'cbi-section','style':'max-width:900px;margin-top:.7em;'},kids);},
	renderBody:function(){
		var st=this.status||{},items=(this.results&&this.results.items)||[],busy=!!(st.starting||st.probing||st.state==='verifying'),active=!!(st.enabled||st.running||busy),actions=[];
		if(!active){actions.push(E('button',{'class':'cbi-button cbi-button-action','disabled':!st.engine_ready?'disabled':null,'click':ui.createHandlerFn(this,'startBearhole')},_('🐻 Запустить Bearhole')));}else{
			if(!busy)actions.push(E('button',{'class':'cbi-button','click':ui.createHandlerFn(this,'recheck')},_('Проверить маршруты заново')));
			actions.push(E('button',{'class':'cbi-button cbi-button-negative','click':ui.createHandlerFn(this,'stopBearhole')},_('Остановить Bearhole')));
		}
		var engineWarn=!st.engine_ready?E('div',{'class':'alert-message warning','style':'margin:.7em 0;'},reasonText(st.engine_reason)):E('span',{});
		var summary=(String(st.valid_routes||0)+' '+_('пригодных')+' · '+String(st.degraded_routes||0)+' '+_('частично пригодных'));
		var statusCard=card(_('OpenWrt Bearhole'),[
			E('p',{'class':'pb-muted'},_('Аварийный системный прокси для самого OpenWrt. При запуске Bearhole автоматически проверяет всю цепочку прокси, оставляет рабочие маршруты, запускает локальный HWELP proxy и только затем использует его для системных загрузок. LAN и маршрутизация Podkop/Forkop не изменяются.')),
			engineWarn,row(_('Состояние Bearhole'),stateNode(st)),row(_('HWELP proxy'),hwelpNode(st)),row(_('Адрес HWELP proxy'),E('code',{},st.gateway||'http://127.0.0.1:1066')),row(_('Рабочий маршрут'),E('span',{},st.route_label||st.route_id||'—')),row(_('Последняя проверка маршрутов'),E('span',{},summary)),row(_('Последнее изменение'),E('span',{},age(st.updated_at))),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;margin-top:.8em;'},actions)
		]);
		var table=this.resultsTable(items);
		var details=E('details',{'style':'max-width:1100px;margin-top:1em;'},[E('summary',{'style':'cursor:pointer;font-weight:600;'},_('Что проверяет Bearhole')),E('div',{'class':'pb-hint-90','style':'margin:.6em 0;line-height:1.5;'},_('GitHub API — api.github.com; «Архивы GitHub» — codeload.github.com; «Файлы релизов» — реальные вложения GitHub Releases и их redirect-хосты. Если у последнего релиза нет вложений, в этой колонке будет «—».')),E('div',{},[table])]);
		var log=E('details',{'style':'max-width:900px;margin-top:1em;'},[E('summary',{'style':'cursor:pointer;'},_('Журнал Bearhole')),E('pre',{'style':'max-height:320px;overflow:auto;white-space:pre-wrap;font-size:82%;'},this.logText||_('Лог пуст.'))]);
		return E('div',{},[E('h2',{},_('OpenWrt Bearhole')),statusCard,this.progressCard(st),details,log]);
	},
	resultsTable:function(items){if(!items.length)return E('p',{'class':'pb-hint-90'},_('Свежей проверки ещё нет. Нажмите «🐻 Запустить Bearhole» — при первом запуске он сам проверит всю цепочку.'));var rows=items.map(function(x){return E('tr',{},[E('td',{},[E('strong',{},x.label||x.id),E('div',{'class':'pb-hint-90','style':'overflow-wrap:anywhere;'},x.endpoint||'')]),E('td',{},[routeStatus(x.status)]),E('td',{},[q(x.github_core)]),E('td',{},[q(x.github_raw)]),E('td',{},[q(x.github_api)]),E('td',{},[q(x.github_codeload)]),E('td',{},[q(x.github_assets)]),E('td',{},[q(x.openwrt_feeds)]),E('td',{},age(x.checked_at))]);});return E('div',{'style':'overflow-x:auto;'},[E('table',{'class':'table','style':'min-width:1050px;'},[E('thead',{},[E('tr',{},[E('th',{},_('Маршрут')),E('th',{},_('Итог')),E('th',{},'GitHub'),E('th',{},_('Raw-файлы')),E('th',{},'GitHub API'),E('th',{},_('Архивы GitHub')),E('th',{},_('Файлы релизов')),E('th',{},_('Репозитории OpenWrt')),E('th',{},_('Проверено'))])]),E('tbody',{},rows)])]);},
	handleSave:null,handleSaveApply:null,handleReset:null
});
