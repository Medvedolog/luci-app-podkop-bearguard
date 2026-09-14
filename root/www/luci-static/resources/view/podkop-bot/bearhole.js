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
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:center;gap:.4em;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{},label)]);}
function row(label,val){return E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},label),E('span',{'class':'pb-row-val'},[val])]);}
function card(title,children){return E('div',{'class':'cbi-section pb-card','style':'max-width:900px;'},[E('h3',{'style':'margin-top:0;'},title)].concat(children));}
function pbInjectCss(){if(document.getElementById('pb-css'))return;document.querySelector('head').appendChild(E('link',{'id':'pb-css','rel':'stylesheet','type':'text/css','href':L.resource('css/podkop-bot/podkop-bot.css')}));}
function age(ts){var n=parseInt(ts||0,10);if(!n)return '—';var s=Math.max(0,Math.floor(Date.now()/1000)-n);if(s<60)return _('только что');if(s<3600)return Math.floor(s/60)+_(' мин назад');if(s<86400)return Math.floor(s/3600)+_(' ч назад');return Math.floor(s/86400)+_(' дн назад');}
function stateNode(st){if(st.running&&st.state==='ready')return dot('green',_('Готов'));if(st.probing)return dot('yellow',_('Проверка маршрутов'));if(st.enabled&&!st.running)return dot('red',_('Включён, но шлюз не запущен'));if(st.state==='degraded')return dot('yellow',_('Нет полностью пригодного системного маршрута'));return dot(st.enabled?'yellow':'grey',st.enabled?_('Ожидание'):_('Выключен'));}
function q(v){if(v==='ok')return dot('green','OK');if(v==='skip')return dot('grey','—');return dot('red','FAIL');}
function routeStatus(v){if(v==='VALID')return dot('green','VALID');if(v==='DEGRADED')return dot('yellow','DEGRADED');return dot('red','FAIL');}

return view.extend({
	load:function(){pbInjectCss();return Promise.all([callStatus().catch(function(){return {ok:false};}),callResults().catch(function(){return {items:[]};}),callLog(0).catch(function(){return {chunk:'',offset:0};})]);},
	render:function(data){this.status=data[0]||{};this.results=data[1]||{items:[]};this.logText=(data[2]&&data[2].chunk)||'';this.logOffset=(data[2]&&data[2].offset)||0;this.root=E('div',{});dom.content(this.root,this.renderBody());if(this.status.probing)this.schedulePoll(1200);return this.root;},
	refresh:function(){var self=this;return Promise.all([callStatus(),callResults().catch(function(){return {items:[]};}),callLog(this.logOffset||0).catch(function(){return null;})]).then(function(x){self.status=x[0]||{};self.results=x[1]||{items:[]};if(x[2]){self.logOffset=x[2].offset||self.logOffset;if(x[2].chunk)self.logText+=x[2].chunk;}dom.content(self.root,self.renderBody());return self.status;});},
	schedulePoll:function(ms){var self=this;if(this.timer)window.clearTimeout(this.timer);this.timer=window.setTimeout(function(){self.refresh().then(function(st){if(st.probing)self.schedulePoll(1500);});},ms||1500);},
	renderBody:function(){
		var self=this,st=this.status||{},items=(this.results&&this.results.items)||[],enabled=!!st.enabled;
		var toggle=E('input',{type:'checkbox',checked:enabled?'checked':null,'change':ui.createHandlerFn(this,function(ev){var on=!!ev.target.checked;ev.target.disabled=true;return callSetEnabled(on).then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'failed');return self.refresh();}).catch(function(e){ui.addNotification(null,E('p',{},_('Не удалось изменить состояние Bearhole: ')+(e&&e.message||'?')));}).finally(function(){ev.target.disabled=false;});})});
		var test=E('button',{'class':'cbi-button cbi-button-action','disabled':st.probing?'disabled':null,'click':ui.createHandlerFn(this,function(){test.disabled=true;return callQualify().then(function(){return self.refresh();}).then(function(){self.schedulePoll(500);}).finally(function(){test.disabled=false;});})},st.probing?_('Проверка выполняется…'):_('Проверить OpenWrt Bearhole'));
		var reread=E('button',{'class':'cbi-button','click':ui.createHandlerFn(this,function(){return callRefresh().then(function(){return self.refresh();});})},_('Перечитать цепочку'));
		var statusCard=card(_('OpenWrt Bearhole'),[
			E('p',{'class':'pb-muted'},_('Аварийный системный прокси OpenWrt. Системные загрузки, пакетные менеджеры и shell-инструменты используют локальный шлюз и рабочий маршрут из резервной цепочки. LAN и маршрутизация Podkop/Forkop не изменяются.')),
			row(_('Системный прокси OpenWrt'),toggle),row(_('Состояние'),stateNode(st)),row(_('Режим'),E('span',{},_('Авто'))),row(_('Шлюз'),E('code',{},st.gateway||'http://127.0.0.1:1066')),row(_('Текущий маршрут'),E('span',{},st.route_label||st.route_id||'—')),row(_('SYSTEM-маршрутов'),E('span',{},String(st.valid_routes||0)+' VALID · '+String(st.degraded_routes||0)+' DEGRADED')),row(_('Последнее состояние'),E('span',{},age(st.updated_at))),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;margin-top:.8em;'},[test,reread])
		]);
		var table=this.resultsTable(items);
		var details=E('details',{'style':'max-width:900px;margin-top:1em;'},[E('summary',{'style':'cursor:pointer;font-weight:600;'},_('Диагностика SYSTEM')),E('div',{'style':'margin-top:.7em;'},[table])]);
		var log=E('details',{'style':'max-width:900px;margin-top:1em;'},[E('summary',{'style':'cursor:pointer;'},_('Журнал Bearhole')),E('pre',{'style':'max-height:320px;overflow:auto;white-space:pre-wrap;font-size:82%;'},this.logText||_('Лог пуст.'))]);
		return E('div',{},[E('h2',{},_('OpenWrt Bearhole')),statusCard,details,log]);
	},
	resultsTable:function(items){if(!items.length)return E('p',{'class':'pb-hint-90'},_('SYSTEM qualification ещё не выполнялась.'));var rows=items.map(function(x){return E('tr',{},[E('td',{},[E('strong',{},x.label||x.id),E('div',{'class':'pb-hint-90'},x.endpoint||'')]),E('td',{},[routeStatus(x.status)]),E('td',{},[q(x.github_core)]),E('td',{},[q(x.github_raw)]),E('td',{},[q(x.github_api)]),E('td',{},[q(x.github_codeload)]),E('td',{},[q(x.github_assets)]),E('td',{},[q(x.openwrt_feeds)]),E('td',{},age(x.checked_at))]);});return E('div',{'style':'overflow-x:auto;'},[E('table',{'class':'table','style':'min-width:960px;'},[E('thead',{},[E('tr',{},[E('th',{},_('Маршрут')),E('th',{},'SYSTEM'),E('th',{},'GitHub'),E('th',{},'Raw'),E('th',{},'API'),E('th',{},'Codeload'),E('th',{},'Assets'),E('th',{},'OpenWrt feeds'),E('th',{},_('Проверено'))])]),E('tbody',{},rows)])]);},
	handleSave:null,handleSaveApply:null,handleReset:null
});
