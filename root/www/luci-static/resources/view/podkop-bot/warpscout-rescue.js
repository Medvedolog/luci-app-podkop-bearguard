'use strict';
'require view';
'require rpc';
'require dom';
'require ui';

var callWarpStatus = rpc.declare({ object:'podkop_bot_warpscout', method:'status', params:['force'] });
var callRescueStatus = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'status' });
var callRescueMagazine = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'magazine' });
var callRescueSet = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'set', params:['key','value'] });
var callRescueTrigger = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'trigger' });
var callRescueNext = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'next' });
var callRescueFire = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'fire', params:['endpoint'] });
var callRescueReload = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'reload' });
var callRescueStop = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'stop' });

var COLOURS={green:'#33a02c',yellow:'#e8a33d',grey:'#888888',red:'#cc2b2b'};
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:flex-start;gap:.4em;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;margin-top:.28em;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{},label)]);}
function row(label,val){return E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},label),E('span',{'class':'pb-row-val'},[val])]);}
function pbInjectCss(){if(document.getElementById('pb-css'))return;document.querySelector('head').appendChild(E('link',{'id':'pb-css','rel':'stylesheet','type':'text/css','href':L.resource('css/podkop-bot/podkop-bot.css')}));}
function rescueError(reason){var m={warpscout_disabled:_('WARP Rescue выключен'),not_ready:_('WARPSCOUT или account ещё не готовы'),controller_busy:_('револьвер уже выполняет другую команду'),qualification_running:_('сейчас выполняется TG API Routes'),discovery_running:_('сейчас выполняется WARP Discovery'),runtime_handoff_failed:_('не удалось освободить служебный WARP SOCKS'),bad_endpoint:_('некорректный WARP endpoint'),not_in_magazine:_('этого endpoint нет в текущем магазине')};return m[reason]||reason||'?';}
function ago(ts){var n=parseInt(ts||0,10);if(!n)return '—';var s=Math.max(0,Math.floor(Date.now()/1000)-n);if(s<60)return _('только что');if(s<3600)return Math.floor(s/60)+_(' мин назад');if(s<86400)return Math.floor(s/3600)+_(' ч назад');return Math.floor(s/86400)+_(' дн назад');}

return view.extend({
	loadData:function(){return Promise.all([callWarpStatus('').catch(function(){return null;}),callRescueStatus().catch(function(){return null;}),callRescueMagazine().catch(function(){return {ok:false,items:[]};})]);},
	load:function(){pbInjectCss();return this.loadData();},
	render:function(data){this.root=E('div',{});dom.content(this.root,this.renderBody(data));return this.root;},
	refreshView:function(){var self=this;return this.loadData().then(function(d){dom.content(self.root,self.renderBody(d));});},

	magazineCard:function(mag,rs,actionStatus){
		var self=this,items=(mag&&mag.items)||[];
		if(!items.length)return E('div',{'class':'cbi-section pb-card','style':'max-width:820px;'},[E('h3',{'style':'margin-top:0;'},_('Магазин')),E('p',{'class':'pb-hint-90'},_('Магазин пуст. Выполните «Перезарядить»: Discovery → TG API Routes → отбор VALID WARP.'))]);
		var body=items.map(function(x){
			var active=x.state==='active',next=x.state==='next';
			var badge=active?dot('green','ACTIVE'):(next?dot('yellow','NEXT'):dot('grey','READY'));
			var fire=E('button',{
				'class':'cbi-button cbi-button-action',
				'style':'padding:.18em .65em;font-size:82%;min-height:0;',
				'disabled':(active||rs.busy)?'disabled':null,
				'click':ui.createHandlerFn(self,function(){
					dom.content(actionStatus,dot('yellow','FIRE · '+x.endpoint+'…'));
					fire.disabled=true;
					return callRescueFire(x.endpoint).then(function(r){
						dom.content(actionStatus,r&&r.ok?dot('green',r.already_active?_('Уже активен'):_('Патрон выбран — проверяется Telegram и поднимается Rescue')):dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));
						window.setTimeout(function(){self.refreshView();},700);
						window.setTimeout(function(){self.refreshView();},4200);
					}).catch(function(){dom.content(actionStatus,dot('red',_('Ошибка RPC')));}).finally(function(){fire.disabled=false;});
				})
			},active?'ACTIVE':'FIRE');
			var details=[];
			if(x.node||x.node_location)details.push((x.node||'—')+(x.node_location?(' · '+x.node_location):''));
			if(x.seen_as)details.push(_('seen as ') + x.seen_as);
			if(x.tg_latency_ms)details.push(_('TG ')+x.tg_latency_ms+' ms');
			if(x.endpoint_ping)details.push(_('EP ')+x.endpoint_ping);
			if(x.tunnel_ping)details.push(_('TUN ')+x.tunnel_ping);
			if(x.loss)details.push(_('loss ')+x.loss);
			if(x.checked_at)details.push(ago(x.checked_at));
			return E('div',{'style':'border-top:1px solid rgba(127,127,127,.14);padding:.65em 0;'},[
				E('div',{'style':'display:flex;align-items:center;justify-content:space-between;gap:.8em;flex-wrap:wrap;'},[
					E('div',{'style':'display:flex;align-items:center;gap:.6em;flex-wrap:wrap;'},[E('strong',{},String(x.index||'?')+'. '+(x.endpoint||'—')),badge]),
					fire
				]),
				E('div',{'class':'pb-hint-90','style':'margin-top:.25em;'},details.length?details.join(' · '):_('VALID WARP candidate'))
			]);
		});
		return E('div',{'class':'cbi-section pb-card','style':'max-width:820px;'},[
			E('h3',{'style':'margin-top:0;'},_('Магазин')),
			E('p',{'class':'pb-hint-90'},_('Это реальные патроны револьвера: только WARP endpoints, прошедшие TG API Routes как VALID. FIRE вручную выбирает конкретный патрон и перед активацией ещё раз проверяет Telegram Bot API.')),
			E('div',{},body)
		]);
	},

	renderBody:function(data){
		var self=this,st=data[0],rs=data[1]||{},mag=data[2]||{items:[]};
		if(!st||!st.installed)return E('div',{},[E('h2',{},_('Револьвер WARP')),E('div',{'class':'cbi-section pb-card','style':'max-width:820px;'},[dot('grey',_('WARPSCOUT не установлен')),E('div',{'style':'margin-top:.7em;'},[E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/update')},_('Открыть Обновление'))])])]);
		var cfg=st.config||{},enabled=!!cfg.enabled,auto=E('input',{type:'checkbox',checked:rs.auto?'checked':null}),actionStatus=E('div',{'style':'margin-top:.6em;'});
		function act(call,label,disabled){return E('button',{'class':'cbi-button','disabled':(rs.busy||disabled)?'disabled':null,'click':ui.createHandlerFn(self,function(){dom.content(actionStatus,dot('yellow',label+'…'));return call().then(function(r){dom.content(actionStatus,r&&r.ok?dot('green',_('Команда принята — состояние обновится автоматически')):dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));window.setTimeout(function(){self.refreshView();},700);window.setTimeout(function(){self.refreshView();},3500);}).catch(function(){dom.content(actionStatus,dot('red',_('Ошибка RPC')));});})},label);}
		var powerBtn=E('button',{'class':'cbi-button '+(enabled?'cbi-button-negative':'cbi-button-positive'),'disabled':rs.busy?'disabled':null,'click':ui.createHandlerFn(this,function(){
			dom.content(actionStatus,dot('yellow',enabled?_('Останавливаю WARP…'):_('Запускаю WARP…')));
			var p=enabled?callRescueStop():callRescueTrigger();
			return p.then(function(r){dom.content(actionStatus,r&&r.ok?dot('green',enabled?_('WARP остановлен'):_('WARP запускается')):dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));window.setTimeout(function(){self.refreshView();},700);window.setTimeout(function(){self.refreshView();},3500);}).catch(function(){dom.content(actionStatus,dot('red',_('Ошибка RPC')));});
		})},enabled?_('Остановить WARP'):_('Запустить WARP'));
		var saveAuto=E('button',{'class':'cbi-button cbi-button-apply','click':ui.createHandlerFn(this,function(){return callRescueSet('rescue_auto',auto.checked?'1':'0').then(function(){return self.refreshView();});})},_('Сохранить автоматику'));
		var busyLabel=String(rs.state||_('работает'));
		if(rs.busy&&rs.state==='reloading'){
			var phase={manual:_('подготовка'),discovery:_('Discovery'),qualification:_('TG API Routes'),building:_('сбор магазина')};
			busyLabel=_('Перезарядка')+' · '+(phase[rs.reason]||rs.reason||_('подготовка'));
		}
		var stateNode=rs.running?dot('green',_('работает')):(rs.busy?dot('yellow',busyLabel):dot((rs.state==='exhausted'||rs.state==='reload_failed'||rs.state==='fire_failed')?'red':'grey',enabled?_('не запущен'):String(rs.state||_('остановлен'))));
		var magNode=(rs.total||0)>0?dot('green',_('заряжен · ')+String(rs.total)+_(' VALID WARP-маршрутов')):dot('grey',_('пуст · сначала нужны VALID результаты TG API Routes'));
		return E('div',{},[
			E('h2',{},_('Револьвер WARP')),
			E('p',{'class':'pb-muted','style':'max-width:820px;'},_('Револьвер — постоянный резервный WARP SOCKS для Telegram. Он использует только WARP-адреса, прошедшие TG API Routes со статусом VALID, и работает на роутере независимо от открытой вкладки LuCI.')),
			E('div',{'class':'cbi-section pb-card','style':'max-width:820px;'},[
				E('h3',{'style':'margin-top:0;'},_('WARP Rescue')),
				E('p',{'class':'pb-muted'},_('«Перезарядить» выполняет Discovery → TG API Routes → сбор магазина и сразу поднимает лучший рабочий WARP. «Следующий WARP» переключает Rescue на следующий VALID endpoint.')),
				row(_('WARP Rescue'),enabled?dot('green',_('включён')):dot('grey',_('выключен'))),row(_('Состояние'),stateNode),row(_('Магазин'),magNode),row(_('Позиция'),E('span',{},String(rs.index||0)+' / '+String(rs.total||0))),row(_('Активный WARP endpoint'),E('span',{},rs.endpoint||'—')),row(_('Rescue SOCKS'),rs.running?dot('green',(rs.proxy||('socks5h://127.0.0.1:'+(cfg.socks_port||18191)))):E('span',{},rs.proxy||('socks5h://127.0.0.1:'+(cfg.socks_port||18191)))),row(_('Автоперезарядка'),auto),
				E('p',{'class':'pb-hint-90'},_('Автоперезарядка срабатывает при исчерпании сохранённых VALID WARP: выполняется новый Discovery → TG API Routes → сбор магазина, после чего Rescue снова поднимает рабочий SOCKS. Закрытие LuCI работающий Rescue SOCKS не останавливает.')),
				E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;'},[powerBtn,saveAuto,act(callRescueNext,_('Следующий WARP'),!enabled),act(callRescueReload,_('Перезарядить'),false)]),actionStatus,
				E('p',{'class':'pb-hint-90','style':'margin-top:.8em;'},_('OpenWrt Rescue / Bearhole: отдельный аварийный рубильник предусмотрен в backend, но его влияние на маршрутизацию пока не активировано до фиксации точной семантики.'))
			]),
			this.magazineCard(mag,rs,actionStatus),
			E('div',{'style':'margin-top:.7em;display:flex;gap:.5em;flex-wrap:wrap;'},[E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/settings/warpscout')},_('Расширенные настройки WARP Rescue')),E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/runtime/tg-api-routes')},_('Открыть TG API Routes')),E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/update')+'#warpscout-update'},_('Установка / удаление WARPSCOUT'))])
		]);
	},
	handleSave:null,handleSaveApply:null,handleReset:null
});
