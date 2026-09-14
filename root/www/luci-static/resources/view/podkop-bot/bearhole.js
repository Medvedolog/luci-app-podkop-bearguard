'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callStatus = rpc.declare({ object:'podkop_bot_bearhole', method:'status' });
var callResults = rpc.declare({ object:'podkop_bot_bearhole', method:'results' });
var callSetEnabled = rpc.declare({ object:'podkop_bot_bearhole', method:'set_enabled', params:['enabled'] });
var callQualify = rpc.declare({ object:'podkop_bot_bearhole', method:'qualify_start' });
var callRefresh = rpc.declare({ object:'podkop_bot_bearhole', method:'refresh_routes' });
var callLog = rpc.declare({ object:'podkop_bot_bearhole', method:'log', params:['offset'] });

var COLOURS={green:'#33a02c',yellow:'#e8a33d',grey:'#888888',red:'#cc2b2b'};
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:center;gap:.4em;min-width:0;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{'style':'overflow-wrap:anywhere;'},label)]);}
function row(label,val){return E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},label),E('span',{'class':'pb-row-val'},[val])]);}
function card(title,children){return E('div',{'class':'cbi-section pb-card','style':'max-width:900px;'},[E('h3',{'style':'margin-top:0;'},title)].concat(children));}
function pbInjectCss(){if(document.getElementById('pb-css'))return;document.querySelector('head').appendChild(E('link',{'id':'pb-css','rel':'stylesheet','type':'text/css','href':L.resource('css/podkop-bot/podkop-bot.css')}));}
function age(ts){var n=parseInt(ts||0,10);if(!n)return '—';var s=Math.max(0,Math.floor(Date.now()/1000)-n);if(s<60)return _('только что');if(s<3600)return Math.floor(s/60)+_(' мин назад');if(s<86400)return Math.floor(s/3600)+_(' ч назад');return Math.floor(s/86400)+_(' дн назад');}
function stateNode(st){if(st.running&&st.state==='ready')return dot('green',_('Работает'));if(st.probing)return dot('yellow',_('Проверяю маршруты'));if(st.enabled&&!st.running)return dot('yellow',_('Запускаю шлюз'));if(st.state==='degraded')return dot('red',_('Рабочий маршрут не найден'));return dot('grey',_('Выключен'));}
function checkNode(v){if(v==='ok')return dot('green',_('доступен'));if(v==='skip')return dot('grey','—');return dot('red',_('нет доступа'));}
function routeStatus(v){if(v==='VALID')return dot('green',_('пригоден'));if(v==='DEGRADED')return dot('yellow',_('частично'));return dot('red',_('непригоден'));}
function engineReason(st){var r=String((st&&st.engine_reason)||'');if(!r)return '';var m={ucode_missing:_('Не найден ucode.'),proxy_missing:_('Не найден podkop-bearhole-proxy.'),ucode_modules_missing:_('Не установлены компоненты движка Bearhole: ucode-mod-socket, ucode-mod-struct и ucode-mod-uloop.')};return m[r]||r;}

return view.extend({
	load:function(){pbInjectCss();return Promise.all([callStatus().catch(function(){return {ok:false};}),callResults().catch(function(){return {items:[]};}),callLog(0).catch(function(){return {chunk:'',offset:0};})]);},
	render:function(data){this.status=data[0]||{};this.results=data[1]||{items:[]};this.logText=(data[2]&&data[2].chunk)||'';this.logOffset=(data[2]&&data[2].offset)||0;this.actionError='';this.root=E('div',{});dom.content(this.root,this.renderBody());if(this.status.probing)this.schedulePoll(700);return this.root;},
	refresh:function(){var self=this;return Promise.all([callStatus(),callResults().catch(function(){return {items:[]};}),callLog(this.logOffset||0).catch(function(){return null;})]).then(function(x){self.status=x[0]||{};self.results=x[1]||{items:[]};if(x[2]){self.logOffset=x[2].offset||self.logOffset;if(x[2].chunk)self.logText+=x[2].chunk;}dom.content(self.root,self.renderBody());return self.status;});},
	schedulePoll:function(ms){var self=this;if(this.timer)window.clearTimeout(this.timer);this.timer=window.setTimeout(function(){self.refresh().then(function(st){if(st.probing||(st.enabled&&!st.running))self.schedulePoll(1000);});},ms||1000);},
	startBearhole:function(){var self=this;this.actionError='';this.starting=true;dom.content(this.root,this.renderBody());return callSetEnabled(true).then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'start_failed');self.starting=false;return self.refresh();}).then(function(st){if(st.probing||(st.enabled&&!st.running))self.schedulePoll(400);}).catch(function(e){self.starting=false;var reason=(e&&e.message)||'start_failed';var map={ucode_missing:_('Не найден ucode.'),proxy_missing:_('Не найден podkop-bearhole-proxy.'),ucode_modules_missing:_('Не установлены ucode-mod-socket, ucode-mod-struct и ucode-mod-uloop.'),enable_failed:_('Локальный шлюз не запустился.')};self.actionError=map[reason]||reason;return self.refresh();});},
	stopBearhole:function(){var self=this;this.actionError='';return callSetEnabled(false).then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'stop_failed');return self.refresh();}).catch(function(e){self.actionError=(e&&e.message)||'stop_failed';return self.refresh();});},
	recheck:function(){var self=this;this.actionError='';return callQualify().then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'check_failed');return self.refresh();}).then(function(){self.schedulePoll(400);}).catch(function(e){self.actionError=(e&&e.message)||'check_failed';return self.refresh();});},
	progressBlock:function(st){var total=parseInt(st.progress_total||0,10)||0,done=parseInt(st.progress_done||0,10)||0,label=st.progress_label||st.progress_route||'',txt='';if(this.starting)txt=_('Запускаю локальный шлюз 127.0.0.1:1066…');else if(st.probing){txt=_('Проверяю рабочие маршруты');if(total)txt+=' · '+Math.min(done+1,total)+' / '+total;if(label)txt+=' · '+label;}else if(st.running&&st.state==='ready')txt=_('Bearhole готов. Системные загрузки идут через выбранный рабочий маршрут.');else if(st.enabled&&!st.running)txt=_('Ожидаю запуска локального шлюза…');else return E('span',{});var pct=total?Math.min(100,Math.round((done/total)*100)):(st.running?20:5);if(st.running&&st.state==='ready')pct=100;return E('div',{'style':'margin:.8em 0;padding:.7em .8em;border:1px solid rgba(127,127,127,.18);border-radius:6px;'},[E('div',{'style':'margin-bottom:.35em;'},dot(st.running&&st.state==='ready'?'green':'yellow',txt)),E('progress',{'max':'100','value':String(pct),'style':'width:100%;height:.9em;'})]);},
	renderBody:function(){
		var self=this,st=this.status||{},items=(this.results&&this.results.items)||[],enabled=!!st.enabled,running=!!st.running,busy=!!st.probing||!!this.starting;
		var startBtn=E('button',{'class':'cbi-button cbi-button-action','disabled':busy?'disabled':null,'click':ui.createHandlerFn(this,'startBearhole')},'🐻 '+_('Запустить Bearhole'));
		var stopBtn=E('button',{'class':'cbi-button cbi-button-negative','disabled':this.starting?'disabled':null,'click':ui.createHandlerFn(this,'stopBearhole')},_('Остановить Bearhole'));
		var recheck=E('button',{'class':'cbi-button','disabled':(!running||st.probing)?'disabled':null,'click':ui.createHandlerFn(this,'recheck')},_('Перепроверить маршруты'));
		var reread=E('button',{'class':'cbi-button','click':ui.createHandlerFn(this,function(){return callRefresh().then(function(){return self.refresh();});})},_('Перечитать цепочку'));
		var engine=engineReason(st),problem=this.actionError||engine;
		var actions=[enabled?stopBtn:startBtn];if(running)actions.push(recheck);actions.push(reread);
		var statusCard=card(_('OpenWrt Bearhole'),[
			E('p',{'class':'pb-muted'},_('Аварийный системный прокси для самого OpenWrt. Нажмите «Запустить Bearhole»: он сам проверит доступные маршруты, выберет рабочий и направит системные загрузки через локальный шлюз 127.0.0.1:1066. LAN и маршрутизация Podkop/Forkop не изменяются.')),
			row(_('Состояние'),stateNode(st)),
			row(_('Шлюз'),E('code',{},st.gateway||'http://127.0.0.1:1066')),
			row(_('Рабочий маршрут'),E('span',{},st.route_label||st.route_id||'—')),
			row(_('Проверенные маршруты'),E('span',{},String(st.valid_routes||0)+' '+_('пригодных')+' · '+String(st.degraded_routes||0)+' '+_('частично пригодных'))),
			this.progressBlock(st),
			problem?E('div',{'style':'margin:.6em 0;color:#cc2b2b;'},dot('red',problem)):E('span',{}),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;margin-top:.8em;'},actions)
		]);
		var details=E('details',{'style':'max-width:900px;margin-top:1em;'},[E('summary',{'style':'cursor:pointer;font-weight:600;'},_('Что проверяет Bearhole')),E('div',{'style':'margin-top:.7em;'},[this.resultsTable(items)])]);
		var log=E('details',{'style':'max-width:900px;margin-top:1em;'},[E('summary',{'style':'cursor:pointer;'},_('Журнал Bearhole')),E('pre',{'style':'max-height:320px;overflow:auto;white-space:pre-wrap;font-size:82%;'},this.logText||_('Лог пуст.'))]);
		return E('div',{},[E('h2',{},_('OpenWrt Bearhole')),statusCard,details,log]);
	},
	resultsTable:function(items){if(!items.length)return E('p',{'class':'pb-hint-90'},_('Проверка ещё не выполнялась. Она автоматически начнётся при запуске Bearhole.'));var rows=items.map(function(x){return E('tr',{},[E('td',{},[E('strong',{},x.label||x.id),E('div',{'class':'pb-hint-90','style':'overflow-wrap:anywhere;'},x.endpoint||'')]),E('td',{},[routeStatus(x.status)]),E('td',{},[checkNode(x.github_core)]),E('td',{},[checkNode(x.github_raw)]),E('td',{},[checkNode(x.github_api)]),E('td',{},[checkNode(x.github_codeload)]),E('td',{},[checkNode(x.github_assets)]),E('td',{},[checkNode(x.openwrt_feeds)]),E('td',{},age(x.checked_at))]);});return E('div',{'style':'overflow-x:auto;max-width:100%;'},[E('table',{'class':'table','style':'min-width:900px;'},[E('thead',{},[E('tr',{},[E('th',{},_('Маршрут')),E('th',{},_('Итог')),E('th',{},'GitHub'),E('th',{},'Raw'),E('th',{},'API'),E('th',{},'Codeload'),E('th',{},'Assets'),E('th',{},_('Репозитории OpenWrt')),E('th',{},_('Проверено'))])]),E('tbody',{},rows)])]);},
	handleSave:null,handleSaveApply:null,handleReset:null
});
