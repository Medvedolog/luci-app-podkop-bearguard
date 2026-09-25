'use strict';
'require view';
'require rpc';
'require dom';
'require ui';
'require poll';

/* The single WARP page: WARPSCOUT install, the revolver (WARP Rescue), its
 * magazine, and — folded below — account, search parameters, manual
 * discovery and logs. "Запустить WARP" drives the whole first run on the
 * router side (rescue `start`: account → Discovery → Telegram API
 * qualification → FIRE), so a first-time operator never has to visit the
 * account, search and revolver sections in turn. */

var callWsStatus = rpc.declare({ object:'podkop_bot_warpscout', method:'status', params:['force'] });
var callWsRun = rpc.declare({ object:'podkop_bot_warpscout', method:'run' });
var callWsRemove = rpc.declare({ object:'podkop_bot_warpscout', method:'remove' });
var callWsLog = rpc.declare({ object:'podkop_bot_warpscout', method:'log', params:['offset'] });
var callWsSet = rpc.declare({ object:'podkop_bot_warpscout', method:'config_set', params:['key','value'] });
var callWsImport = rpc.declare({ object:'podkop_bot_warpscout', method:'account_import' });
var callWsAction = rpc.declare({ object:'podkop_bot_warpscout', method:'action_run', params:['action','target'] });
var callWsActionLog = rpc.declare({ object:'podkop_bot_warpscout', method:'action_log', params:['offset'] });
var callWsShortlist = rpc.declare({ object:'podkop_bot_warpscout', method:'shortlist' });
var callWsSelect = rpc.declare({ object:'podkop_bot_warpscout', method:'select', params:['endpoint'] });
var callRescueStatus = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'status' });
var callRescueMagazine = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'magazine' });
var callRescueSet = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'set', params:['key','value'] });
var callRescueStart = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'start' });
var callRescueNext = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'next' });
var callRescueFire = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'fire', params:['endpoint'] });
var callRescueReload = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'reload' });
var callRescueStop = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'stop' });
var callRescueLog = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'log', params:['offset'] });
var callWarpRtStart = rpc.declare({ object:'podkop_bot_warpscout_runtime', method:'start', params:['endpoint'] });
var callWarpRtStop = rpc.declare({ object:'podkop_bot_warpscout_runtime', method:'stop' });
var callWarpRtTelegram = rpc.declare({ object:'podkop_bot_warpscout_runtime', method:'telegram_test' });

var COLOURS={green:'#33a02c',yellow:'#e8a33d',grey:'#888888',red:'#cc2b2b'};
var CARD_STYLE='max-width:820px;';
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:flex-start;gap:.4em;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;margin-top:.28em;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{},label)]);}
function helpLabel(label,help){if(!help)return label;return E('span',{'title':help,'style':'cursor:help;text-decoration:underline dotted;text-underline-offset:2px;'},[label,E('span',{'style':'margin-left:.35em;color:#888;text-decoration:none;'},'ⓘ')]);}
function row(label,val,help){return E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},helpLabel(label,help)),E('span',{'class':'pb-row-val'},[val])]);}
function card(title,children){return E('div',{'class':'cbi-section pb-card','style':CARD_STYLE},[E('h3',{'style':'margin-top:0;'},title)].concat(children.filter(Boolean)));}
/* Folded secondary section. Kept outside the 1.5 s status refresh, so an open
 * section or a half-typed filter survives a running reload. */
function fold(title,children,open){return E('details',{'class':'cbi-section pb-card','style':CARD_STYLE,'open':open?'':null},[E('summary',{'style':'cursor:pointer;font-weight:600;font-size:110%;'},title),E('div',{'style':'margin-top:.8em;'},children)]);}
function logPre(){return E('pre',{'style':'max-width:100%;box-sizing:border-box;max-height:360px;overflow:auto;background:var(--background-color-high,var(--background-color,var(--background,rgba(30,30,30,.96))));padding:.7em;border-radius:6px;white-space:pre;font-family:monospace;font-size:82%;line-height:1.35;margin:.6em 0 0;'},_('Лог пуст.'));}
function pbInjectCss(){if(document.getElementById('pb-css'))return;document.querySelector('head').appendChild(E('link',{'id':'pb-css','rel':'stylesheet','type':'text/css','href':L.resource('css/podkop-bot/podkop-bot.css')}));}
function rescueError(reason){var m={warpscout_disabled:_('WARP Rescue выключен'),not_ready:_('WARPSCOUT или учётная запись WARP ещё не готовы'),not_installed:_('WARPSCOUT не установлен'),controller_busy:_('револьвер уже выполняет другую команду'),qualification_running:_('сейчас выполняется проверка Telegram API'),discovery_running:_('сейчас выполняется поиск WARP-узлов или операция с учётной записью'),runtime_handoff_failed:_('не удалось освободить тестовый WARP SOCKS'),bad_endpoint:_('некорректный WARP-узел'),not_in_magazine:_('этого WARP-узла нет в текущем магазине'),account_missing:_('нет учётной записи WARP'),already_running:_('операция уже выполняется')};return m[reason]||reason||'?';}
function ago(ts){var n=parseInt(ts||0,10);if(!n)return '—';var s=Math.max(0,Math.floor(Date.now()/1000)-n);if(s<60)return _('только что');if(s<3600)return Math.floor(s/60)+_(' мин назад');if(s<86400)return Math.floor(s/3600)+_(' ч назад');return Math.floor(s/86400)+_(' дн назад');}
function magazineLoader(){
	var cells=[];
	for(var i=0;i<6;i++)cells.push(E('span',{'class':'pb-mag-load-cell','style':'animation-delay:'+(i*140)+'ms;'},'■'));
	return E('span',{'class':'pb-mag-load','title':_('Магазин перезаряжается'),'aria-label':_('Магазин перезаряжается')},[E('span',{'class':'pb-mag-load-cells'},cells),E('span',{'class':'pb-mag-load-text'},_('патроны в барабан…'))]);
}

return view.extend({
	loadData:function(){return Promise.all([
		callWsStatus('').catch(function(){return null;}),
		callRescueStatus().catch(function(){return null;}),
		callRescueMagazine().catch(function(){return {ok:false,items:[]};}),
		callWsShortlist().catch(function(){return {ok:false,items:[]};})
	]);},
	load:function(){pbInjectCss();return this.loadData();},
	render:function(data){
		this.topRoot=E('div',{});this.restRoot=E('div',{});
		this.root=E('div',{},[
			E('h2',{},_('WARP')),
			E('p',{'class':'pb-muted','style':'max-width:820px;'},_('Постоянный резервный WARP SOCKS для Telegram. WARPSCOUT ищет WARP-узлы, револьвер оставляет только прошедшие проверку Telegram Bot API (VALID) и держит один из них в эфире независимо от открытой страницы LuCI.')),
			this.topRoot,this.restRoot
		]);
		this.fillTop(data);this.fillRest(data);
		if(data[1]&&data[1].busy)this.watchOperation();
		this._lastRescueKey=this.rescueKey(data[1]);
		var self=this;
		poll.add(function(){
			if(self.watchTimer||document.visibilityState!=='visible')return;
			return callRescueStatus().then(function(rs){
				var key=self.rescueKey(rs);
				if(key===self._lastRescueKey)return;
				return self.refreshTop().then(function(d){if(d[1]&&d[1].busy)self.watchOperation();});
			}).catch(function(){});
		},5);
		return this.root;
	},
	rescueKey:function(rs){return [rs&&rs.state,rs&&rs.running,rs&&rs.busy,rs&&rs.total,rs&&rs.updated_at].join('|');},
	fillTop:function(d){dom.content(this.topRoot,this.renderTop(d));},
	fillRest:function(d){dom.content(this.restRoot,this.renderRest(d));window.setTimeout(this.loadSavedLogs.bind(this),0);},
	refreshTop:function(){var self=this;return this.loadData().then(function(d){self.fillTop(d);self._lastRescueKey=self.rescueKey(d[1]);return d;});},
	refreshView:function(){var self=this;return this.loadData().then(function(d){self.fillTop(d);self.fillRest(d);self._lastRescueKey=self.rescueKey(d[1]);return d;});},
	/* Only the revolver/magazine block is repainted while an operation runs;
	 * the folded sections below are rebuilt once when it finishes. The rescue and
	 * action logs are refetched on every tick so the mini-log tails live instead
	 * of freezing on stale text until the operation ends. */
	watchOperation:function(){var self=this;if(this.watchTimer)window.clearTimeout(this.watchTimer);this.watchTimer=window.setTimeout(function(){self.loadSavedLogs();self.refreshTop().then(function(d){if(d[1]&&d[1].busy)self.watchOperation();else{self.watchTimer=null;self.fillRest(d);}}).catch(function(){self.watchTimer=window.setTimeout(function(){self.watchTimer=null;self.watchOperation();},3000);});},1500);},

	renderTop:function(data){
		var st=data[0],rs=data[1]||{},mag=data[2]||{items:[]};
		if(!st||!st.installed)return [this.installFirstCard(st)];
		return [this.revolverCard(st,rs),this.magazineCard(mag,rs)];
	},
	renderRest:function(data){
		var st=data[0]||{},sl=data[3]||{items:[]};
		if(!st.installed)return [];
		return [
			this.accountFold(st),
			this.configFold(st),
			this.discoveryFold(st,sl),
			this.componentFold(),
			this.logsFold(),
			E('div',{'style':'margin-top:.7em;display:flex;gap:.5em;flex-wrap:wrap;'},[E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/runtime/services')},_('Проверка маршрутов / Telegram API'))])
		];
	},

	/* ---- WARPSCOUT install / update / remove -------------------------------- */

	pollInstall:function(statusNode,logNode){
		var offset=0,text='',failures=0;
		return new Promise(function(resolve){
			var tick=function(){callWsLog(offset).then(function(r){
				failures=0;
				if(r&&r.chunk){text+=r.chunk;logNode.textContent=text;logNode.scrollTop=logNode.scrollHeight;}
				if(r&&typeof r.offset==='number')offset=r.offset;
				if(r&&r.done){dom.content(statusNode,r.exit_code===0?dot('green',_('WARPSCOUT установлен.')):dot('red',_('Установка WARPSCOUT завершилась с ошибкой — см. журнал.')));resolve(r.exit_code===0);return;}
				window.setTimeout(tick,1200);
			}).catch(function(){failures++;if(failures>=10){dom.content(statusNode,dot('red',_('Не удалось получить журнал установки WARPSCOUT')));resolve(false);return;}window.setTimeout(tick,1800);});};
			tick();
		});
	},
	runInstall:function(statusNode,logNode){
		var self=this;
		logNode.style.display='block';logNode.textContent='';
		dom.content(statusNode,dot('yellow',_('Установка WARPSCOUT запущена…')));
		return callWsRun().then(function(r){
			if(!r||!r.ok){dom.content(statusNode,dot('red',(r&&r.reason==='already_running')?_('установка уже выполняется'):_('не удалось запустить установку')));return false;}
			return self.pollInstall(statusNode,logNode);
		}).catch(function(){dom.content(statusNode,dot('red',_('Ошибка вызова службы WARPSCOUT')));return false;});
	},
	startRevolver:function(statusNode){
		var self=this;
		dom.content(statusNode,dot('yellow',_('Запускаю WARP…')));
		return callRescueStart().then(function(r){
			if(r&&r.ok){dom.content(statusNode,dot('yellow',r.already_active?_('WARP уже в эфире'):_('WARP запускается…')));return self.refreshView().then(function(){self.watchOperation();});}
			dom.content(statusNode,dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));
		}).catch(function(){dom.content(statusNode,dot('red',_('Ошибка RPC')));});
	},
	installFirstCard:function(st){
		var self=this,status=E('div',{'style':'margin-top:.6em;'}),log=E('pre',{'class':'pb-mono','style':'display:none;max-width:100%;box-sizing:border-box;max-height:280px;overflow:auto;background:var(--background-color-high,var(--background-color,var(--background,rgba(30,30,30,.96))));padding:.6em;border-radius:6px;white-space:pre-wrap;font-size:80%;margin-top:.5em;'});
		if(!st)return card(_('WARP'),[dot('red',_('Служба WARPSCOUT недоступна'))]);
		var both,only;
		function go(thenStart){
			if(!confirm(_('Установить WARPSCOUT официальным install.sh проекта?')))return;
			both.disabled=true;only.disabled=true;
			return self.runInstall(status,log).then(function(ok){
				if(!ok){both.disabled=false;only.disabled=false;return;}
				if(thenStart)return self.startRevolver(status);
				return self.refreshView();
			});
		}
		both=E('button',{'class':'cbi-button cbi-button-action','click':ui.createHandlerFn(this,function(){return go(true);})},_('Установить и запустить WARP'));
		only=E('button',{'class':'cbi-button','click':ui.createHandlerFn(this,function(){return go(false);})},_('Только установить'));
		return card(_('WARPSCOUT не установлен'),[
			E('p',{'class':'pb-hint-90'},_('WARP Rescue работает через WARPSCOUT — отдельную утилиту поиска WARP-узлов. «Установить и запустить WARP» делает всё за один раз: установка → учётная запись WARP → поиск узлов → проверка Telegram API → запуск лучшего узла. Обычно это занимает 3–10 минут; после установки страницу можно закрыть.')),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;'},[both,only,E('a',{'class':'cbi-button','href':(st&&st.releases_url)||'https://github.com/vernette/warpscout/releases','target':'_blank','rel':'noopener'},_('Страница WARPSCOUT'))]),
			status,log
		]);
	},
	componentFold:function(){
		var holder=E('div',{},dot('grey',_('проверяю…')));
		var d=fold(_('WARPSCOUT: версия, обновление, удаление'),[holder],false);
		this.fillComponent(holder,'');
		return d;
	},
	fillComponent:function(holder,force){
		var self=this;
		callWsStatus(force).then(function(d){
			var opStatus=E('div',{'style':'margin-top:.5em;'}),opLog=E('pre',{'class':'pb-mono','style':'display:none;max-width:100%;box-sizing:border-box;max-height:280px;overflow:auto;background:var(--background-color-high,var(--background-color,var(--background,rgba(30,30,30,.96))));padding:.6em;border-radius:6px;white-space:pre-wrap;font-size:80%;margin-top:.5em;'});
			var installed=!!(d&&d.installed),latest=(d&&d.latest)||'',upd=!!(d&&d.update_available);
			var recheck=E('button',{'class':'cbi-button','click':function(){dom.content(opStatus,dot('grey',_('Проверка…')));self.fillComponent(holder,'true');}},_('Проверить версию'));
			var runBtn=E('button',{'class':upd?'cbi-button cbi-button-action':'cbi-button','click':ui.createHandlerFn(self,function(){
				if(!confirm(_('Запустить официальный установщик WARPSCOUT? Он обновит или переустановит компонент.')))return;
				runBtn.disabled=true;
				return self.runInstall(opStatus,opLog).then(function(){runBtn.disabled=false;window.setTimeout(function(){self.fillComponent(holder,'true');},500);});
			})},upd?_('Обновить WARPSCOUT'):_('Переустановить WARPSCOUT'));
			var removeBtn=E('button',{'class':'cbi-button cbi-button-negative','disabled':installed?null:'disabled','click':ui.createHandlerFn(self,function(){
				if(!confirm(_('Удалить WARPSCOUT полностью? Будут остановлены WARP Rescue и тестовый SOCKS, удалены программа, учётная запись WARP, найденные узлы и локальные настройки WARPSCOUT. Podkop и Telegram-бот не затрагиваются.')))return;
				removeBtn.disabled=true;dom.content(opStatus,dot('yellow',_('Удаление WARPSCOUT…')));
				return callWsRemove().then(function(r){if(!r||!r.ok){dom.content(opStatus,dot('red',_('Не удалось удалить WARPSCOUT: ')+((r&&r.reason)||'?')));removeBtn.disabled=false;return;}return self.refreshView();}).catch(function(){dom.content(opStatus,dot('red',_('Ошибка вызова службы WARPSCOUT')));removeBtn.disabled=false;});
			})},_('Удалить WARPSCOUT'));
			var latestNode=latest?(upd?dot('yellow',latest+_(' — доступно')):dot('green',latest+_(' — актуально'))):dot('yellow',_('последнюю версию проверить не удалось'));
			dom.content(holder,[
				row(_('Установлено'),installed?dot('green',d.current||'—'):dot('grey',_('не установлен'))),
				row(_('В репозитории'),latestNode),
				E('div',{'style':'margin-top:.7em;display:flex;gap:.5em;flex-wrap:wrap;align-items:center;'},[E('a',{'class':'cbi-button','href':(d&&d.releases_url)||'https://github.com/vernette/warpscout/releases','target':'_blank','rel':'noopener'},_('Страница WARPSCOUT')),recheck,runBtn,removeBtn]),
				E('p',{'class':'pb-hint-90','style':'margin-top:.6em;'},_('То же самое доступно на странице «Обновление». Удаление останавливает WARP Rescue и очищает учётную запись, настройки и найденные узлы WARPSCOUT.')),
				opStatus,opLog
			]);
		}).catch(function(){dom.content(holder,dot('red',_('Служба WARPSCOUT недоступна')));});
	},

	/* ---- Revolver ---------------------------------------------------------- */

	revolverCard:function(st,rs){
		var self=this,cfg=st.config||{},enabled=!!cfg.enabled,auto=E('input',{type:'checkbox',checked:rs.auto?'checked':null}),autostart=E('input',{type:'checkbox',checked:rs.autostart?'checked':null}),actionStatus=E('div',{'style':'margin-top:.6em;'});
		this._actionStatus=actionStatus;
		function act(call,label,disabled){return E('button',{'class':'cbi-button','disabled':(rs.busy||disabled)?'disabled':null,'click':ui.createHandlerFn(self,function(){dom.content(actionStatus,dot('yellow',label+' · '+_('команда отправлена…')));return call().then(function(r){if(r&&r.ok){dom.content(actionStatus,dot('yellow',label+' · '+_('выполняется…')));self.watchOperation();}else dom.content(actionStatus,dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));}).catch(function(){dom.content(actionStatus,dot('red',_('Ошибка RPC')));});})},label);}
		var powerBtn=E('button',{'class':'cbi-button '+(enabled?'cbi-button-negative':'cbi-button-positive'),'disabled':rs.busy?'disabled':null,'click':ui.createHandlerFn(this,function(){
			if(!enabled)return self.startRevolver(actionStatus);
			dom.content(actionStatus,dot('yellow',_('Останавливаю WARP…')));
			return callRescueStop().then(function(r){if(r&&r.ok){dom.content(actionStatus,dot('yellow',_('WARP останавливается…')));self.watchOperation();}else dom.content(actionStatus,dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));}).catch(function(){dom.content(actionStatus,dot('red',_('Ошибка RPC')));});
		})},enabled?_('Остановить WARP'):_('Запустить WARP'));
		var saveAuto=E('button',{'class':'cbi-button cbi-button-apply','disabled':rs.busy?'disabled':null,'click':ui.createHandlerFn(this,function(){return callRescueSet('rescue_auto',auto.checked?'1':'0').then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'write_failed');return callRescueSet('rescue_autostart',autostart.checked?'1':'0');}).then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'write_failed');return self.refreshTop();}).catch(function(e){dom.content(actionStatus,dot('red',_('Ошибка настроек автоматики: ')+((e&&e.message)||'?')));});})},_('Применить автоматику'));
		var busyLabel=String(rs.state||_('работает'));
		if(rs.busy&&rs.state==='reloading'){
			var phase={manual:_('открываю барабан · готовлюсь к перезарядке'),register:_('получаю учётную запись WARP'),discovery:_('ищу патроны · Discovery WARP-узлов'),qualification:_('проверяю капсюли · Telegram API qualification'),building:_('заряжаю магазин · укладываю только VALID'),exhausted:_('сохранённые узлы не сработали · ищу новые')};
			busyLabel=_('Перезарядка')+' · '+(phase[rs.reason]||rs.reason||_('подготовка'));
		}else if(rs.busy&&rs.state==='firing'){
			busyLabel=_('Взвожу курок')+' · '+String(rs.index||0)+' / '+String(rs.total||0)+' · '+_('тестовый отстрел: SOCKS → Telegram getMe');
		}
		var idleLabel={exhausted:_('магазин исчерпан · ни один узел не прошёл Telegram getMe'),reload_failed:(rs.reason==='account_failed'?_('не удалось получить учётную запись WARP · см. журнал'):_('перезарядка не удалась · см. журнал')),start_failed:_('первый запуск не удался · повтор через 5 минут · см. журнал'),fire_failed:_('узел не прошёл проверку Telegram'),paused:_('на паузе · идёт ручная проверка'),stopped:_('остановлен')};
		var stateNode=rs.running?dot('green',_('работает')):(rs.busy?dot('yellow',busyLabel):dot((rs.state==='exhausted'||rs.state==='reload_failed'||rs.state==='start_failed'||rs.state==='fire_failed')?'red':'grey',idleLabel[rs.state]||(enabled?_('не запущен'):_('остановлен'))));
		var magNode=(rs.total||0)>0?dot('green',_('заряжен · ')+String(rs.total)+_(' VALID WARP-маршрутов')):dot('grey',_('пуст · заполнится при запуске'));
		var position=rs.busy&&rs.state==='reloading'?magazineLoader():E('span',{},String(rs.index||0)+' / '+String(rs.total||0));
		var firstRun=!enabled&&!rs.running&&!rs.busy&&!((rs.total||0)>0)?E('p',{'class':'pb-hint-90','style':'margin:.2em 0 .7em;padding:.55em .75em;border-left:3px solid #33a02c;background:rgba(51,160,44,.08);border-radius:4px;'},_('«Запустить WARP» всё делает сам: при необходимости создаёт учётную запись WARP, ищет узлы, проверяет Telegram API, заряжает магазин и ставит лучший узел в эфир. Обычно 3–10 минут; страницу можно закрыть.')):null;
		return card(_('Револьвер WARP'),[
			firstRun,
			row(_('WARP Rescue'),enabled?dot('green',_('включён')):dot('grey',_('выключен'))),row(_('Состояние'),stateNode),row(_('Магазин'),magNode),row(_('Позиция'),position),row(_('Активный WARP-узел'),E('span',{},rs.endpoint||'—')),
			row(_('SOCKS WARP Rescue'),rs.running?dot('green',(rs.proxy||('socks5h://127.0.0.1:'+(cfg.socks_port||18191)))):E('span',{},rs.proxy||('socks5h://127.0.0.1:'+(cfg.socks_port||18191))),_('Локальный SOCKS5h-адрес, который используют бот и другие локальные службы.')),
			row(_('Учётная запись WARP'),st.account_ready?dot('green',_('готова')):dot('grey',_('будет создана при запуске'))),
			E('div',{'style':'margin:.8em 0;padding:.7em .8em;border:1px solid rgba(127,127,127,.18);border-radius:8px;'},[
				E('h4',{'style':'margin:.05em 0 .55em;'},_('Автоматика Rescue')),
				row(_('Автозапуск и самовосстановление'),E('label',{'style':'display:inline-flex;align-items:center;gap:.5em;font-weight:600;'},[autostart,E('span',{},_('Включить'))])),
				E('p',{'class':'pb-hint-90','style':'margin:.25em 0 .65em;'},_('Поднимает WARP Rescue после загрузки роутера и восстанавливает SOCKS, если он упал. Ручная кнопка «Остановить WARP» отключает Rescue и запрещает watchdog поднимать его снова.')),
				row(_('Автоперезарядка магазина'),E('label',{'style':'display:inline-flex;align-items:center;gap:.5em;font-weight:600;'},[auto,E('span',{},_('Включить'))])),
				E('p',{'class':'pb-hint-90','style':'margin:.25em 0 0;'},_('Когда сохранённые VALID WARP-узлы исчерпаны, автоматически выполняет новый поиск, Telegram qualification и собирает магазин заново.'))
			]),
			E('p',{'class':'pb-hint-90'},_('«Перезарядить» выполняет поиск WARP-узлов → проверку Telegram API → сбор магазина → запуск лучшего WARP. «Следующий WARP» переключает Rescue на следующий VALID узел.')),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;'},[powerBtn,saveAuto,act(callRescueNext,_('Следующий WARP'),!enabled),act(callRescueReload,_('Перезарядить'),false)]),actionStatus
		]);
	},

	magazineCard:function(mag,rs){
		var self=this,items=(mag&&mag.items)||[],actionStatus=this._actionStatus;
		if(!items.length)return card(_('Магазин'),[E('p',{'class':'pb-hint-90'},_('Магазин пуст. «Запустить WARP» или «Перезарядить» заполнят его: поиск WARP-узлов → проверка Telegram API → отбор VALID.'))]);
		var body=items.map(function(x){
			var active=x.state==='active',next=x.state==='next';
			var badge=active?dot('green','ON-AIR'):(next?dot('yellow','NEXT'):dot('grey','READY'));
			var fire=E('button',{
				'class':'cbi-button',
				'style':active?'padding:.18em .65em;font-size:82%;min-height:0;background:#33a02c;color:#fff;border-color:#33a02c;':'padding:.18em .65em;font-size:82%;min-height:0;background:#e8a33d;color:#111;border-color:#e8a33d;',
				'disabled':(active||rs.busy)?'disabled':null,
				'click':ui.createHandlerFn(self,function(){
					dom.content(actionStatus,dot('yellow','FIRE · '+x.endpoint+' · '+_('запуск SOCKS → Telegram getMe…')));
					fire.disabled=true;
					return callRescueFire(x.endpoint).then(function(r){
						dom.content(actionStatus,r&&r.ok?dot('yellow',r.already_active?_('Уже ON-AIR'):_('WARP-узел принят · проверяю WARP и Telegram…')):dot('red',_('Ошибка: ')+rescueError(r&&r.reason)));
						if(r&&r.ok)self.watchOperation();else fire.disabled=false;
					}).catch(function(){dom.content(actionStatus,dot('red',_('Ошибка RPC')));fire.disabled=false;});
				})
			},active?'ON-AIR':'FIRE');
			var details=[];
			if(x.node||x.node_location)details.push((x.node||'—')+(x.node_location?(' · '+x.node_location):''));
			if(x.seen_as)details.push(_('выход ') + x.seen_as);
			if(x.tg_latency_ms)details.push(_('Задержка TG ')+x.tg_latency_ms+' мс');
			if(x.endpoint_ping&&x.endpoint_ping!=='?'&&x.endpoint_ping!=='—')details.push(_('Задержка узла ')+x.endpoint_ping);
			if(x.tunnel_ping&&x.tunnel_ping!=='?'&&x.tunnel_ping!=='—')details.push(_('Туннель ')+x.tunnel_ping);
			if(x.loss&&x.loss!=='?')details.push(_('Потери ')+x.loss);
			if(x.checked_at)details.push(ago(x.checked_at));
			return E('div',{'style':'border-top:1px solid rgba(127,127,127,.14);padding:.65em 0;'},[
				E('div',{'style':'display:flex;align-items:center;justify-content:space-between;gap:.8em;flex-wrap:wrap;'},[
					E('div',{'style':'display:flex;align-items:center;gap:.6em;flex-wrap:wrap;'},[E('strong',{},String(x.index||'?')+'. '+(x.endpoint||'—')),badge]),fire
				]),E('div',{'class':'pb-hint-90','style':'margin-top:.25em;'},details.length?details.join(' · '):_('Кандидат WARP со статусом VALID'))
			]);
		});
		return card(_('Магазин'),[E('p',{'class':'pb-hint-90'},_('Здесь только WARP-узлы, прошедшие проверку Telegram API со статусом VALID. FIRE выбирает конкретный узел и перед ON-AIR ещё раз проверяет Telegram Bot API.')),E('div',{},body)]);
	},

	/* ---- Folded: account, parameters, manual discovery, logs --------------- */

	accountFold:function(st){
		var self=this,status=E('div',{'style':'margin-top:.5em;'});
		var reg=E('button',{'class':'cbi-button','title':_('Создаёт новую локальную учётную запись WARP. Перерегистрация заменяет существующую.'),'click':ui.createHandlerFn(this,function(){
			if(st.account_ready&&!confirm(_('Заменить текущую учётную запись WARP новой?')))return;
			return self.runAction('register','',status,reg);
		})},st.account_ready?_('Перерегистрировать учётную запись'):_('Создать учётную запись WARP'));
		var imp=E('button',{'class':'cbi-button','title':_('Импортирует ранее сохранённый JSON учётной записи WARP.'),'click':ui.createHandlerFn(this,function(){
			dom.content(status,dot('grey',_('Загрузка JSON учётной записи…')));
			return ui.uploadFile('/tmp/warpscout-account-upload.json',null,_('Файл будет проверен как JSON и сохранён с правами 0600. Секреты не выводятся в LuCI и журнал.')).then(function(){
				return callWsImport().then(function(r){
					dom.content(status,r&&r.ok?dot('green',_('Учётная запись импортирована')):dot('red',_('Импорт отклонён: ')+((r&&r.reason)||'?')));
					if(r&&r.ok)return self.refreshView();
				});
			}).catch(function(e){dom.content(status,dot('yellow',(e&&e.message)||_('Загрузка отменена')));});
		})},_('Импортировать JSON учётной записи'));
		return fold(_('Учётная запись WARP')+' · '+(st.account_ready?_('готова'):_('нет')),[
			E('p',{'class':'pb-hint-90'},st.account_ready?_('Учётная запись готова. Обычно здесь ничего делать не нужно.'):_('Учётную запись создаёт «Запустить WARP». Вручную — только если нужна своя (импорт JSON) или новая.')),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;'},[reg,imp]),status
		],false);
	},

	configFold:function(st){
		var c=st.config||{},self=this;
		function select(values,cur){var s=E('select',{'class':'cbi-input-select'});values.forEach(function(v){s.appendChild(E('option',{value:v[0],selected:v[0]===cur?'selected':null},v[1]));});return s;}
		function input(v,ph){return E('input',{type:'text','class':'cbi-input-text',value:v||'',placeholder:ph||''});}
		var policy=select([['manual',_('Ручной')],['reserve',_('Резерв')],['emergency',_('Аварийный')]],c.policy||'manual');
		var proto=select([['awg','AWG'],['wg','WG'],['masque','MASQUE'],['masque-h2','MASQUE-H2']],c.protocol||'awg');
		var port=input(String(c.socks_port||18191),'18191');
		var node=input(c.node,'HEL,ARN'),country=input(c.country,'FI,SE'),exnode=input(c.exclude_node,'DME'),excountry=input(c.exclude_country,'RU');
		var status=E('div',{'style':'margin-top:.5em;'});
		var save=E('button',{'class':'cbi-button cbi-button-apply','title':_('Сохраняет параметры WARPSCOUT. Запущенный Rescue использует новые параметры при следующем запуске или перезарядке.'),'click':ui.createHandlerFn(this,function(){
			var ops=[['policy',policy.value],['protocol',proto.value],['socks_port',port.value.trim()],['node',node.value.trim()],['country',country.value.trim()],['exclude_node',exnode.value.trim()],['exclude_country',excountry.value.trim()]];
			dom.content(status,dot('grey',_('Сохранение…')));
			var p=Promise.resolve();ops.forEach(function(x){p=p.then(function(){return callWsSet(x[0],x[1]).then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'write_failed');});});});
			return p.then(function(){dom.content(status,dot('green',_('Настройки сохранены')));return self.refreshTop();}).catch(function(e){dom.content(status,dot('red',_('Ошибка: ')+(e&&e.message||'?')));});
		})},_('Сохранить'));
		return fold(_('Параметры SOCKS и поиска'),[
			row(_('Порт SOCKS5h'),port,_('Локальный порт WARP Rescue SOCKS5h. По умолчанию 18191. Не должен конфликтовать с другими службами роутера.')),
			row(_('Протокол'),proto,_('Транспорт, которым WARPSCOUT поднимает WARP-туннель. AWG обычно является основным вариантом; остальные выбираются при необходимости совместимости.')),
			row(_('Режим'),policy,_('Ручной — выбор узла оператором. Резерв — использование WARP как резервного транспорта. Аварийный — режим для сценариев аварийного восстановления.')),
			row(_('Фильтр узлов'),node,_('Разрешённые коды WARP-узлов, например HEL,ARN. Несколько значений указываются через запятую. Пусто — без фильтра по узлам.')),
			row(_('Фильтр стран'),country,_('Разрешённые страны WARP-узлов, например FI,SE. Пусто — без фильтра по стране.')),
			row(_('Исключить узлы'),exnode,_('Коды WARP-узлов, которые не должны попадать в результаты поиска.')),
			row(_('Исключить страны'),excountry,_('Страны, которые нужно исключить из результатов поиска.')),
			E('p',{'class':'pb-hint-90'},_('Фильтры напрямую передаются WARPSCOUT и применяются при следующем поиске или перезарядке.')),
			E('div',{'style':'margin-top:.7em;'},[save]),status
		],false);
	},

	discoveryFold:function(st,sl){
		var self=this,status=E('div',{'style':'margin-top:.5em;'}),items=(sl&&sl.items)||[],body=E('div',{});
		var scan=E('button',{'class':'cbi-button','disabled':!st.account_ready?'disabled':null,'title':_('Полный поиск и ранжирование WARP-узлов без проверки Telegram API и без изменения магазина.'),'click':ui.createHandlerFn(this,function(){return self.runAction('scan','',status,scan);})},_('Найти WARP-узлы'));
		var target=E('button',{'class':'cbi-button','disabled':!(st.account_ready&&st.config&&st.config.active_endpoint)?'disabled':null,'title':_('Повторно проверяет только выбранный WARP-узел без полного поиска.'),'click':ui.createHandlerFn(this,function(){return self.runAction('target',(st.config&&st.config.active_endpoint)||'',status,target);})},_('Перепроверить выбранный узел'));
		if(!items.length)dom.content(body,E('p',{'class':'pb-hint-90'},_('Список пока пуст. Он заполняется при запуске, перезарядке или ручном поиске.')));
		else dom.content(body,items.map(function(x){
			var active=x.endpoint===sl.active,testStatus=E('span',{'style':'margin-left:.6em;'});
			var selectBtn=E('button',{'class':'cbi-button'+(active?' cbi-button-positive':''),'disabled':active?'disabled':null,'title':_('Сделать этот WARP-узел выбранным в настройках WARPSCOUT. Это не переключает ON-AIR узел револьвера.'),'click':ui.createHandlerFn(self,function(){return callWsSelect(x.endpoint).then(function(r){if(r&&r.ok)return self.refreshView();});})},active?_('Выбран'):_('Выбрать'));
			var tgBtn=E('button',{'class':'cbi-button','style':'padding:.2em .65em;font-size:85%;','title':_('Точечно проверить Telegram Bot API через этот WARP-узел. Результат не перестраивает магазин револьвера.'),'click':ui.createHandlerFn(self,function(){return self.manualTelegramTest(x.endpoint,testStatus,tgBtn);})},_('TG API'));
			return E('div',{'style':'border-top:1px solid rgba(127,127,127,.14);padding:.65em 0;'},[
				E('div',{'style':'display:flex;justify-content:space-between;gap:1em;align-items:center;flex-wrap:wrap;'},[E('strong',{},x.endpoint),E('div',{'style':'display:flex;gap:.45em;align-items:center;flex-wrap:wrap;'},[tgBtn,selectBtn])]),
				E('div',{'class':'pb-hint-90'},[(x.node||'—')+' · '+(x.node_location||'—')+' · '+_('выход ')+(x.seen_as||'—')+' · '+_('туннель ')+(x.tunnel_ping||'—')+' · '+_('потери ')+(x.loss||'—'),testStatus])
			]);
		}));
		return fold(_('Ручной поиск и найденные узлы')+(items.length?(' · '+items.length):''),[
			E('p',{'class':'pb-hint-90'},_('Для диагностики. Револьверу это не нужно: запуск и перезарядка ищут узлы сами. В магазин попадают только узлы со статусом VALID после проверки Telegram Bot API; кнопка TG API проверяет один узел и магазин не перестраивает.')),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;'},[scan,target]),status,
			E('div',{'style':'margin-top:.6em;'},[body])
		],false);
	},

	logsFold:function(){
		this._actionLogPre=logPre();this._rescueLogPre=logPre();
		return fold(_('Журналы'),[
			E('p',{'class':'pb-hint-90'},_('Журналы последней операции сохраняются после её завершения.')),
			E('details',{'open':''},[E('summary',{'style':'cursor:pointer;','title':_('Журнал запуска, остановки, FIRE, NEXT и перезарядки WARP Rescue.')},_('Журнал WARP Rescue')),this._rescueLogPre]),
			E('details',{'style':'margin-top:.6em;'},[E('summary',{'style':'cursor:pointer;','title':_('Вывод последнего поиска WARP-узлов или операции с учётной записью.')},_('Последний поиск / журнал учётной записи')),this._actionLogPre])
		],false);
	},

	loadSavedLogs:function(){
		var a=this._actionLogPre,r=this._rescueLogPre;
		if(a)callWsActionLog(-1).then(function(x){a.textContent=(x&&x.chunk)||_('Лог пуст.');}).catch(function(){});
		if(r)callRescueLog(-1).then(function(x){r.textContent=(x&&x.chunk)||_('Лог пуст.');}).catch(function(){});
	},

	manualTelegramTest:function(endpoint,status,btn){
		btn.disabled=true;
		dom.content(status,dot('yellow',_('Временно запускаю WARP-узел ')+endpoint+_(' и проверяю Telegram Bot API…')));
		return callWarpRtStop().catch(function(){return null;}).then(function(){
			return callWarpRtStart(endpoint);
		}).then(function(r){
			if(!r||!r.ok)throw new Error((r&&r.reason)||'warp_start_failed');
			return callWarpRtTelegram();
		}).then(function(t){
			if(t&&t.verified_bot_api)dom.content(status,dot('green',_('Telegram VALID · HTTP ')+(t.http||'200')+(t.latency_ms?(' · '+t.latency_ms+' мс'):'')));
			else if(t&&t.telegram_reached)dom.content(status,dot('yellow',_('Telegram достижим, но не VALID · HTTP ')+(t.http||'—')));
			else dom.content(status,dot('red',_('Telegram FAIL · ')+((t&&t.reason)||'?')));
		}).catch(function(e){
			dom.content(status,dot('red',_('Проверка не завершилась: ')+((e&&e.message)||'?')));
		}).then(function(){
			return callWarpRtStop().catch(function(){return null;});
		}).finally(function(){btn.disabled=false;});
	},

	runAction:function(action,target,status,btn){
		var self=this;btn.disabled=true;dom.content(status,dot('yellow',_('Операция выполняется… журнал — в разделе «Журналы».')));
		return callWsAction(action,target||'').then(function(r){
			if(!r||!r.ok){btn.disabled=false;dom.content(status,dot('red',_('Не удалось запустить: ')+rescueError(r&&r.reason)));return;}
			var off=0;
			return new Promise(function(resolve){
				function tick(){callWsActionLog(off).then(function(x){
					if(x&&typeof x.offset==='number')off=x.offset;
					if(x&&x.done){btn.disabled=false;dom.content(status,x.exit_code===0?dot('green',_('Операция завершена')):dot('red',_('WARPSCOUT завершился с кодом ')+x.exit_code));self.loadSavedLogs();if(x.exit_code===0)self.refreshView();resolve(x);return;}
					window.setTimeout(tick,1200);
				}).catch(function(){window.setTimeout(tick,1800);});}
				tick();
			});
		}).catch(function(){btn.disabled=false;dom.content(status,dot('red',_('Ошибка RPC')));});
	},

	handleSave:null,handleSaveApply:null,handleReset:null
});
