'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callStatus = rpc.declare({ object:'podkop_bot_warpscout', method:'status', params:['force'] });
var callSet = rpc.declare({ object:'podkop_bot_warpscout', method:'config_set', params:['key','value'] });
var callImport = rpc.declare({ object:'podkop_bot_warpscout', method:'account_import' });
var callAction = rpc.declare({ object:'podkop_bot_warpscout', method:'action_run', params:['action','target'] });
var callActionLog = rpc.declare({ object:'podkop_bot_warpscout', method:'action_log', params:['offset'] });
var callShortlist = rpc.declare({ object:'podkop_bot_warpscout', method:'shortlist' });
var callSelect = rpc.declare({ object:'podkop_bot_warpscout', method:'select', params:['endpoint'] });
var callRescueStatus = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'status' });
var callRescueTrigger = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'trigger' });
var callRescueStop = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'stop' });
var callRescueLog = rpc.declare({ object:'podkop_bot_warpscout_rescue', method:'log', params:['offset'] });
var callWarpRtStart = rpc.declare({ object:'podkop_bot_warpscout_runtime', method:'start', params:['endpoint'] });
var callWarpRtStop = rpc.declare({ object:'podkop_bot_warpscout_runtime', method:'stop' });
var callWarpRtTelegram = rpc.declare({ object:'podkop_bot_warpscout_runtime', method:'telegram_test' });

var COLOURS = { green:'#33a02c', yellow:'#e8a33d', grey:'#888888', red:'#cc2b2b' };
function dot(c, label) {
	return E('span', { 'style':'display:inline-flex;align-items:flex-start;gap:.4em;' }, [
		E('span', { 'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;margin-top:.28em;background:'+(COLOURS[c]||COLOURS.grey)+';' }),
		E('span', {}, label)
	]);
}
function row(label, value) {
	return E('div', { 'class':'pb-row pb-row--plain' }, [ E('span', { 'class':'pb-row-label' }, label), E('span', { 'class':'pb-row-val' }, value) ]);
}
function card(title, children) {
	return E('div', { 'class':'cbi-section', 'style':'max-width:820px;border:1px solid var(--border-color-medium,rgba(127,127,127,.2));border-radius:8px;padding:1em 1.2em;background:var(--background-color-high,var(--background-color,var(--background,rgba(40,40,40,.94))));margin-top:1em;' }, [ E('h3', { 'style':'margin-top:0;' }, title) ].concat(children));
}
function logPre() {
	return E('pre', { 'style':'max-width:100%;box-sizing:border-box;max-height:360px;overflow:auto;background:var(--background-color-high,var(--background-color,var(--background,rgba(30,30,30,.96))));padding:.7em;border-radius:6px;white-space:pre;font-family:monospace;font-size:82%;line-height:1.35;margin:.6em 0 0;' }, _('Лог пуст.'));
}
function pbInjectCss() {
	if (document.getElementById('pb-css')) return;
	document.querySelector('head').appendChild(E('link', { 'id':'pb-css', 'rel':'stylesheet', 'type':'text/css', 'href':L.resource('css/podkop-bot/podkop-bot.css') }));
}

return view.extend({
	loadData: function() {
		return Promise.all([
			callStatus('').catch(function(){return {ok:false};}),
			callShortlist().catch(function(){return {ok:false,items:[]};}),
			callRescueStatus().catch(function(){return {ok:false,running:false,state:'unknown',total:0};})
		]);
	},

	load: function() {
		pbInjectCss();
		return this.loadData();
	},

	render: function(data) {
		this.root = E('div', {});
		dom.content(this.root, this.renderBody(data));
		return this.root;
	},

	refreshView: function() {
		var self=this;
		return this.loadData().then(function(data){ dom.content(self.root, self.renderBody(data)); });
	},

	renderBody: function(data) {
		var st=data[0]||{}, sl=data[1]||{items:[]}, rs=data[2]||{};
		this._st=st; this._sl=sl; this._rs=rs;
		var out=E('div', {}, [
			E('h2', {}, _('WARP Rescue / WARPSCOUT')),
			E('p', { 'class':'pb-hint-90', 'style':'max-width:820px;' }, _('WARPSCOUT выполняет Discovery и ранжирование WARP endpoints. Рабочий пользовательский SOCKS — WARP Rescue: он использует только прошедшие TG API Routes кандидаты и живёт на роутере независимо от открытой вкладки LuCI. Служебный test SOCKS используется только внутри ручных тестов и отдельно не показывается.')),
			this.statusCard(st),
			this.accountCard(st),
			this.configCard(st),
			this.scanCard(st,sl),
			this.shortlistCard(sl),
			this.rescueCard(st,rs),
			this.logsCard()
		]);
		window.setTimeout(this.loadSavedLogs.bind(this), 0);
		return out;
	},

	statusCard: function(st) {
		return card(_('Состояние'), [
			row(_('WARPSCOUT'), st.installed ? dot('green', _('установлен')) : dot('yellow', _('не установлен'))),
			row(_('Версия'), st.current || '—'),
			row(_('Account'), st.account_ready ? dot('green', _('готов')) : dot('yellow', _('отсутствует'))),
			row(_('Выбранный endpoint'), (st.config && st.config.active_endpoint) || '—'),
			E('div', { 'style':'margin-top:.7em;display:flex;gap:.5em;flex-wrap:wrap;' }, [
				E('a', { 'class':'cbi-button', 'href':L.url('admin/services/podkop-bot/update')+'#warpscout-update' }, _('Установка / удаление WARPSCOUT')),
				E('a', { 'class':'cbi-button', 'href':L.url('admin/services/podkop-bot/transport/warp-revolver') }, _('Открыть револьвер'))
			])
		]);
	},

	accountCard: function(st) {
		var self=this, status=E('div', { 'style':'margin-top:.5em;' });
		var reg=E('button', { 'class':'cbi-button cbi-button-action', 'disabled':!st.installed ? 'disabled' : null, 'click':ui.createHandlerFn(this,function(){ return self.runAction('register','',status,reg); }) }, st.account_ready ? _('Перерегистрировать account') : _('Создать WARP account'));
		var imp=E('button', { 'class':'cbi-button', 'click':ui.createHandlerFn(this,function(){
			dom.content(status,dot('grey',_('Загрузка account JSON…')));
			return ui.uploadFile('/tmp/warpscout-account-upload.json', null, _('Файл будет проверен как JSON и сохранён с правами 0600. Секреты не выводятся в LuCI и журнал.')).then(function(){
				return callImport().then(function(r){
					dom.content(status, r&&r.ok ? dot('green',_('Account импортирован')) : dot('red',_('Импорт отклонён: ')+((r&&r.reason)||'?')));
					if(r&&r.ok) return self.refreshView();
				});
			}).catch(function(e){ dom.content(status,dot('yellow',(e&&e.message)||_('Загрузка отменена'))); });
		}) }, _('Импортировать account JSON'));
		return card(_('WARP account'), [
			E('p', { 'class':'pb-hint-90' }, st.account_ready ? _('Account готов. Следующий шаг — найти рабочие WARP endpoints.') : _('Сначала создайте или импортируйте WARP account. Без него поиск endpoints недоступен.')),
			E('div', { 'class':'pb-action-row', 'style':'display:flex;gap:.5em;flex-wrap:wrap;' }, [reg,imp]), status
		]);
	},

	configCard: function(st) {
		var c=st.config||{}, self=this;
		function select(values, cur) { var s=E('select',{'class':'cbi-input-select'}); values.forEach(function(v){ s.appendChild(E('option',{value:v[0],selected:v[0]===cur?'selected':null},v[1])); }); return s; }
		function input(v, ph) { return E('input',{type:'text','class':'cbi-input-text',value:v||'',placeholder:ph||''}); }
		var policy=select([['manual',_('Manual')],['reserve',_('Reserve')],['emergency',_('Emergency')]],c.policy||'manual');
		var proto=select([['awg','AWG'],['wg','WG'],['masque','MASQUE'],['masque-h2','MASQUE-H2']],c.protocol||'awg');
		var port=input(String(c.socks_port||18191),'18191');
		var node=input(c.node,'HEL,ARN'), country=input(c.country,'FI,SE'), exnode=input(c.exclude_node,'DME'), excountry=input(c.exclude_country,'RU');
		var status=E('div',{'style':'margin-top:.5em;'});
		var save=E('button',{'class':'cbi-button cbi-button-apply','click':ui.createHandlerFn(this,function(){
			var ops=[['policy',policy.value],['protocol',proto.value],['socks_port',port.value.trim()],['node',node.value.trim()],['country',country.value.trim()],['exclude_node',exnode.value.trim()],['exclude_country',excountry.value.trim()]];
			dom.content(status,dot('grey',_('Сохранение…')));
			var p=Promise.resolve(); ops.forEach(function(x){ p=p.then(function(){return callSet(x[0],x[1]).then(function(r){if(!r||!r.ok) throw new Error((r&&r.reason)||'write_failed');});}); });
			return p.then(function(){dom.content(status,dot('green',_('Настройки сохранены')));return self.refreshView();}).catch(function(e){dom.content(status,dot('red',_('Ошибка: ')+(e&&e.message||'?')));});
		})},_('Сохранить'));
		var advanced=E('details',{'style':'margin-top:.7em;'},[
			E('summary',{'style':'cursor:pointer;color:#aaa;'},_('Расширенные параметры discovery / reserve')),
			E('div',{'style':'margin-top:.7em;'},[
				row(_('Policy'),policy), row(_('Protocol'),proto),
				row(_('Node filter'),node), row(_('Country filter'),country), row(_('Exclude node'),exnode), row(_('Exclude country'),excountry),
				E('p',{'class':'pb-hint-90'},_('Фильтры напрямую передаются WARPSCOUT. LuCI не переоценивает качество найденных endpoints. Запуск и остановка WARP выполняются через WARP Rescue ниже.'))
			])
		]);
		return card(_('SOCKS / параметры'), [
			row(_('Локальный SOCKS5h port'),port),
			advanced,
			E('div',{'style':'margin-top:.7em;'},[save]),status
		]);
	},

	scanCard: function(st, sl) {
		var self=this,status=E('div',{'style':'margin-top:.5em;'}), items=(sl&&sl.items)||[];
		var scan=E('button',{'class':'cbi-button cbi-button-action','disabled':!(st.installed&&st.account_ready) ? 'disabled' : null,'click':ui.createHandlerFn(this,function(){return self.runAction('scan','',status,scan);})},_('Найти WARP endpoints'));
		var target=E('button',{'class':'cbi-button','disabled':!(st.installed&&st.account_ready&&st.config&&st.config.active_endpoint) ? 'disabled' : null,'click':ui.createHandlerFn(this,function(){return self.runAction('target',(st.config&&st.config.active_endpoint)||'',status,target);})},_('Перепроверить выбранный (--target)'));
		var hint=!st.account_ready ? _('Шаг 1: сначала создайте WARP account выше.') : (!items.length ? _('Шаг 2: выполните поиск. После успешного scan ниже появится shortlist найденных endpoints.') : _('Поиск уже выполнен. Можно повторить полный scan или быстро перепроверить выбранный endpoint.'));
		return card(_('Discovery'), [
			E('p',{'class':'pb-hint-90'},hint),
			E('div',{'class':'pb-action-row','style':'display:flex;gap:.5em;flex-wrap:wrap;'},[scan,target]),status
		]);
	},

	manualTelegramTest: function(endpoint,status,btn) {
		var self=this;
		btn.disabled=true;
		dom.content(status,dot('yellow',_('Временно поднимаю именно ')+endpoint+_(' и проверяю Telegram Bot API…')));
		return callWarpRtStop().catch(function(){return null;}).then(function(){
			return callWarpRtStart(endpoint);
		}).then(function(r){
			if(!r||!r.ok)throw new Error((r&&r.reason)||'warp_start_failed');
			return callWarpRtTelegram();
		}).then(function(t){
			if(t&&t.verified_bot_api)dom.content(status,dot('green',_('Telegram VALID · HTTP ')+(t.http||'200')+(t.latency_ms?(' · '+t.latency_ms+' ms'):'')));
			else if(t&&t.telegram_reached)dom.content(status,dot('yellow',_('Telegram достижим, но не VALID · HTTP ')+(t.http||'—')));
			else dom.content(status,dot('red',_('Telegram FAIL · ')+((t&&t.reason)||'?')));
		}).catch(function(e){
			dom.content(status,dot('red',_('Проверка не завершилась: ')+((e&&e.message)||'?')));
		}).then(function(){
			return callWarpRtStop().catch(function(){return null;});
		}).finally(function(){btn.disabled=false;window.setTimeout(function(){self.refreshView();},1800);});
	},

	shortlistCard: function(sl) {
		var self=this, items=(sl&&sl.items)||[], body=E('div',{});
		if(!items.length) dom.content(body,E('p',{'class':'pb-hint-90'},_('Пока пусто. Если scan в журнале нашёл endpoints, но здесь ничего нет — это ошибка разбора report, а не отсутствие рабочих WARP endpoints.')));
		else dom.content(body,items.map(function(x){
			var active=x.endpoint===sl.active, testStatus=E('span',{'style':'margin-left:.6em;'});
			var selectBtn=E('button',{'class':'cbi-button'+(active?' cbi-button-positive':''),'disabled':active?'disabled':null,'click':ui.createHandlerFn(self,function(){return callSelect(x.endpoint).then(function(r){if(r&&r.ok)return self.refreshView();});})},active?_('Активный'):_('Выбрать'));
			var tgBtn=E('button',{'class':'cbi-button','style':'padding:.2em .65em;font-size:85%;','click':ui.createHandlerFn(self,function(){return self.manualTelegramTest(x.endpoint,testStatus,tgBtn);})},_('TG API'));
			return E('div',{'style':'border-top:1px solid rgba(127,127,127,.14);padding:.65em 0;'},[
				E('div',{'style':'display:flex;justify-content:space-between;gap:1em;align-items:center;flex-wrap:wrap;'},[
					E('strong',{},x.endpoint),
					E('div',{'style':'display:flex;gap:.45em;align-items:center;flex-wrap:wrap;'},[tgBtn,selectBtn])
				]),
				E('div',{'class':'pb-hint-90'},[(x.node||'—')+' · '+(x.node_location||'—')+' · '+_('seen as ')+(x.seen_as||'—')+' · '+_('TUN ')+(x.tunnel_ping||'—')+' · '+_('loss ')+(x.loss||'—'),testStatus])
			]);
		}));
		var next=E('button',{'class':'cbi-button','disabled':items.length<2?'disabled':null,'click':ui.createHandlerFn(this,function(){
			if(items.length<2)return;
			var idx=0; for(var i=0;i<items.length;i++) if(items[i].endpoint===sl.active){idx=i;break;}
			var ep=items[(idx+1)%items.length].endpoint;
			return callSelect(ep).then(function(r){if(r&&r.ok)return self.refreshView();});
		})},_('Следующий endpoint'));
		return card(_('Shortlist'),[
			E('p',{'class':'pb-hint-90'},_('Shortlist — исходный набор кандидатов WARPSCOUT. TG API Routes квалифицирует эти endpoints; в магазин револьвера попадает только подмножество со статусом VALID. Кнопка TG API ниже — ручная точечная проверка и сама магазин не перестраивает.')),
			body,E('div',{'style':'margin-top:.7em;'},[next])
		]);
	},

	rescueCard: function(st, rs) {
		var self=this, cfg=st.config||{}, enabled=!!cfg.enabled, status=E('div',{'style':'margin-top:.6em;'});
		var stateNode=rs.running?dot('green',_('работает')):(rs.busy?dot('yellow',String(rs.state||_('занят'))):dot((rs.state==='exhausted'||rs.state==='reload_failed')?'red':'grey',enabled?_('не запущен'):_('остановлен')));
		var power=E('button',{'class':'cbi-button '+(enabled?'cbi-button-negative':'cbi-button-positive'),'disabled':rs.busy?'disabled':null,'click':ui.createHandlerFn(this,function(){
			dom.content(status,dot('yellow',enabled?_('Останавливаю WARP…'):_('Запускаю WARP…')));
			return (enabled?callRescueStop():callRescueTrigger()).then(function(r){dom.content(status,r&&r.ok?dot('green',enabled?_('WARP остановлен'):_('WARP запускается')):dot('red',_('Ошибка: ')+((r&&r.reason)||'?')));window.setTimeout(function(){self.refreshView();},700);window.setTimeout(function(){self.refreshView();},3500);});
		})},enabled?_('Остановить WARP'):_('Запустить WARP'));
		return card(_('WARP Rescue'),[
			E('p',{'class':'pb-hint-90'},_('Это основной WARP SOCKS. Служебный test SOCKS не показывается: ручные проверки используют его временно и после завершения восстанавливают тот же ON-AIR endpoint Rescue.')),
			row(_('Состояние'),stateNode),
			row(_('Endpoint'),E('span',{},rs.endpoint||cfg.active_endpoint||'—')),
			row(_('Protocol'),E('span',{},String(cfg.protocol||'—').toUpperCase())),
			row(_('SOCKS'),E('span',{},rs.proxy||('socks5h://127.0.0.1:'+(cfg.socks_port||18191)))),
			row(_('Магазин'),(rs.total||0)>0?dot('green',String(rs.total)+_(' VALID')):dot('grey',_('пуст'))),
			row(_('Автоперезарядка'),rs.auto?dot('green',_('включена')):dot('grey',_('выключена'))),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;margin-top:.7em;'},[power,E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/transport/warp-revolver')},_('Открыть револьвер'))]),status
		]);
	},

	logsCard: function() {
		this._actionLogPre=logPre(); this._rescueLogPre=logPre();
		return card(_('Журналы'),[
			E('p',{'class':'pb-hint-90'},_('Журналы последней операции сохраняются после её завершения. Служебный test SOCKS отдельно не отображается.')),
			E('details',{},[E('summary',{'style':'cursor:pointer;'},_('Последний Discovery / account log')),this._actionLogPre]),
			E('details',{'style':'margin-top:.6em;'},[E('summary',{'style':'cursor:pointer;'},_('WARP Rescue log')),this._rescueLogPre])
		]);
	},

	loadSavedLogs: function() {
		var a=this._actionLogPre, r=this._rescueLogPre;
		if(a) callActionLog(0).then(function(x){a.textContent=(x&&x.chunk)||_('Лог пуст.');}).catch(function(){});
		if(r) callRescueLog(0).then(function(x){r.textContent=(x&&x.chunk)||_('Лог пуст.');}).catch(function(){});
	},

	runAction: function(action,target,status,btn) {
		var self=this; btn.disabled=true; dom.content(status,dot('yellow',_('Операция выполняется… журнал доступен внизу страницы.')));
		return callAction(action,target||'').then(function(r){
			if(!r||!r.ok){btn.disabled=false;dom.content(status,dot('red',_('Не удалось запустить: ')+((r&&r.reason)||'?')));return;}
			var off=0;
			return new Promise(function(resolve){
				function tick(){callActionLog(off).then(function(x){
					if(x&&typeof x.offset==='number')off=x.offset;
					if(x&&x.done){btn.disabled=false;dom.content(status,x.exit_code===0?dot('green',_('Операция завершена')):dot('red',_('WARPSCOUT завершился с кодом ')+x.exit_code));self.loadSavedLogs();if(x.exit_code===0)self.refreshView();resolve(x);return;}
					window.setTimeout(tick,1200);
				}).catch(function(){window.setTimeout(tick,1800);});}
				tick();
			});
		}).catch(function(){btn.disabled=false;dom.content(status,dot('red',_('Ошибка RPC')));});
	},

	handleSave:null, handleSaveApply:null, handleReset:null
});
