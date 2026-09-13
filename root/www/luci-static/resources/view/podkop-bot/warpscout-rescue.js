'use strict';
'require view';
'require rpc';
'require dom';
'require ui';

var callWarpStatus = rpc.declare({ object:'podkop_bot_warpscout', method:'status', params:['force'] });
var callWarpSet = rpc.declare({ object:'podkop_bot_warpscout', method:'config_set', params:['key','value'] });
var callRescueStatus = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'status' });
var callRescueSet = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'set', params:['key','value'] });
var callRescueTrigger = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'trigger' });
var callRescueNext = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'next' });
var callRescueReload = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'reload' });
var callRescueStop = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'stop' });

var COLOURS={green:'#33a02c',yellow:'#e8a33d',grey:'#888888',red:'#cc2b2b'};
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:flex-start;gap:.4em;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;margin-top:.28em;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{},label)]);}
function row(label,val){return E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},label),E('span',{'class':'pb-row-val'},[val])]);}
function pbInjectCss(){if(document.getElementById('pb-css'))return;document.querySelector('head').appendChild(E('link',{'id':'pb-css','rel':'stylesheet','type':'text/css','href':L.resource('css/podkop-bot/podkop-bot.css')}));}
function rescueError(reason){var m={warpscout_disabled:_('WARP Rescue выключен'),not_ready:_('WARPSCOUT или account ещё не готовы'),controller_busy:_('револьвер уже выполняет другую команду'),qualification_running:_('сейчас выполняется TG API Routes'),discovery_running:_('сейчас выполняется WARP Discovery'),runtime_handoff_failed:_('не удалось освободить тестовый WARP SOCKS')};return m[reason]||reason||'?';}

return view.extend({
	loadData:function(){return Promise.all([callWarpStatus('').catch(function(){return null;}),callRescueStatus().catch(function(){return null;})]);},
	load:function(){pbInjectCss();return this.loadData();},
	render:function(data){this.root=E('div',{});dom.content(this.root,this.renderBody(data));return this.root;},
	refreshView:function(){var self=this;return this.loadData().then(function(d){dom.content(self.root,self.renderBody(d));});},
	renderBody:function(data){
		var self=this,st=data[0],rs=data[1]||{};
		if(!st||!st.installed)return E('div',{},[E('h2',{},_('Револьвер WARP')),E('div',{'class':'cbi-section pb-card','style':'max-width:820px;'},[dot('grey',_('WARPSCOUT не установлен')),E('div',{'style':'margin-top:.7em;'},[E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/update')},_('Открыть Обновление'))])])]);
		var cfg=st.config||{},enabled=!!cfg.enabled,auto=E('input',{type:'checkbox',checked:rs.auto?'checked':null}),actionStatus=E('div',{'style':'margin-top:.6em;'});
		function act(call,label,needsEnabled){return E('button',{'class':'cbi-button','disabled':(rs.busy||(needsEnabled&&!enabled))?'disabled':null,'click':ui.createHandlerFn(self,function(){dom.content(actionStatus,dot('yellow',label+'…'));return call().then(function(r){dom.content(actionStatus,r&&r.ok?dot('green',_('Команда принята — состояние обновится автоматически')):dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));window.setTimeout(function(){self.refreshView();},700);window.setTimeout(function(){self.refreshView();},3500);}).catch(function(){dom.content(actionStatus,dot('red',_('Ошибка RPC')));});})},label);}
		var toggleRescue=E('button',{'class':'cbi-button '+(enabled?'cbi-button-negative':'cbi-button-positive'),'disabled':rs.busy?'disabled':null,'click':ui.createHandlerFn(this,function(){dom.content(actionStatus,dot('yellow',enabled?_('Выключаю WARP Rescue…'):_('Включаю WARP Rescue…')));return callWarpSet('enabled',enabled?'0':'1').then(function(r){if(!r||!r.ok){dom.content(actionStatus,dot('red',_('Не удалось изменить WARP Rescue')));return;}return self.refreshView();});})},enabled?_('Выключить WARP Rescue'):_('Включить WARP Rescue'));
		var saveAuto=E('button',{'class':'cbi-button cbi-button-apply','click':ui.createHandlerFn(this,function(){return callRescueSet('rescue_auto',auto.checked?'1':'0').then(function(){return self.refreshView();});})},_('Сохранить автоматику'));
		var busyLabel=String(rs.state||_('работает'));
		if(rs.busy&&rs.state==='reloading'){
			var phase={manual:_('подготовка'),discovery:_('Discovery'),qualification:_('TG API Routes'),building:_('сбор магазина')};
			busyLabel=_('Перезарядка')+' · '+(phase[rs.reason]||rs.reason||_('подготовка'));
		}
		var stateNode=rs.running?dot('green',_('активен')):(rs.busy?dot('yellow',busyLabel):dot((rs.state==='exhausted'||rs.state==='reload_failed')?'red':'grey',String(rs.state||_('ожидает'))));
		var magNode=(rs.total||0)>0?dot('green',_('заряжен · ')+String(rs.total)+_(' рабочих WARP-маршрутов')):dot('grey',_('пуст · сначала нужны VALID результаты TG API Routes'));
		return E('div',{},[
			E('h2',{},_('Револьвер WARP')),
			E('p',{'class':'pb-muted','style':'max-width:820px;'},_('Револьвер — быстрый резерв на случай, если обычные маршруты до Telegram перестали работать. Он использует только WARP-адреса, которые прошли проверку TG API Routes и получили статус VALID.')),
			E('div',{'class':'cbi-section pb-card','style':'max-width:820px;'},[
				E('h3',{'style':'margin-top:0;'},_('WARP Rescue — резервный револьвер')),
				E('p',{'class':'pb-muted'},_('«Перезарядить магазин» само выполняет весь цикл: Discovery → TG API Routes → сбор магазина, а затем автоматически включает WARP Rescue. Сам туннель при этом не запускается. «Запустить лучший» включает первый рабочий вариант, а «Следующий WARP» переходит к следующему.')),
				row(_('WARP Rescue'),enabled?dot('green',_('включён')):dot('grey',_('выключен'))),row(_('Состояние'),stateNode),row(_('Магазин'),magNode),row(_('Позиция'),E('span',{},String(rs.index||0)+' / '+String(rs.total||0))),row(_('Активный WARP endpoint'),E('span',{},rs.endpoint||'—')),row(_('Rescue SOCKS'),E('span',{},rs.proxy||('socks5h://127.0.0.1:'+(cfg.socks_port||18191)))),row(_('Автоперезарядка'),auto),
				E('p',{'class':'pb-hint-90'},_('После успешной перезарядки WARP Rescue включается автоматически. Автоперезарядка срабатывает, когда сохранённые VALID WARP закончились: Rescue один раз выполняет Discovery → TG API Routes → собирает новый магазин. Автоматическое переключение POLL/FAST бота на WARP пока не включено.')),
				E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;'},[toggleRescue,saveAuto,act(callRescueTrigger,_('Запустить лучший'),true),act(callRescueNext,_('Следующий WARP'),true),act(callRescueReload,_('Перезарядить магазин'),false),act(callRescueStop,_('Стоп'),false)]),actionStatus,
				E('p',{'class':'pb-hint-90','style':'margin-top:.8em;'},_('OpenWrt Rescue / Bearhole: отдельный аварийный рубильник предусмотрен в backend, но его влияние на маршрутизацию пока не активировано до фиксации точной семантики.'))
			]),
			E('div',{'style':'margin-top:.7em;display:flex;gap:.5em;flex-wrap:wrap;'},[E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/transport/warpscout')},_('Расширенные настройки WARP Rescue')),E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/runtime/tg-api-routes')},_('Открыть TG API Routes'))])
		]);
	},
	handleSave:null,handleSaveApply:null,handleReset:null
});
