'use strict';
'require view.podkop-bot.transport as base';
'require rpc';
'require ui';
'require dom';

var callBearSetEnabled = rpc.declare({ object:'podkop_bot_bearhole', method:'set_enabled', params:['enabled'] });
var callBearQualify = rpc.declare({ object:'podkop_bot_bearhole', method:'qualify_start' });

var COLOURS={green:'#33a02c',yellow:'#e8a33d',grey:'#888888',red:'#cc2b2b'};
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:center;gap:.4em;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{},label)]);}
function engineReason(st){var r=String((st&&st.engine_reason)||'');var m={ucode_missing:_('Не найден ucode'),proxy_missing:_('Не найден podkop-bearhole-proxy'),ucode_modules_missing:_('Не установлены компоненты Bearhole: ucode-mod-socket, ucode-mod-struct и ucode-mod-uloop')};return m[r]||r;}

/* Keep the route list operational and compact. Bearhole is presented as one
 * emergency action, while detailed editing semantics stay behind a hint. */
return base.constructor.extend({
	bearholeCard:function(){
		var self=this,st=this.bearStatus||{},enabled=!!st.enabled,running=!!st.running,busy=!!st.probing;
		var start=E('button',{'class':'cbi-button cbi-button-action','disabled':busy?'disabled':null,'click':ui.createHandlerFn(this,function(){
			self._bearError='';start.disabled=true;
			return callBearSetEnabled(true).then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'start_failed');return self.refreshBearhole(true);}).catch(function(e){var reason=(e&&e.message)||'start_failed',map={ucode_missing:_('Не найден ucode'),proxy_missing:_('Не найден podkop-bearhole-proxy'),ucode_modules_missing:_('Не установлены ucode-mod-socket, ucode-mod-struct и ucode-mod-uloop'),enable_failed:_('Локальный шлюз не запустился')};self._bearError=map[reason]||reason;return self.refreshBearhole(false);}).finally(function(){start.disabled=false;});
		})},'🐻 '+_('Запустить Bearhole'));
		var stop=E('button',{'class':'cbi-button cbi-button-negative','click':ui.createHandlerFn(this,function(){self._bearError='';return callBearSetEnabled(false).then(function(){return self.refreshBearhole(false);});})},_('Остановить Bearhole'));
		var check=E('button',{'class':'cbi-button','disabled':(!running||busy)?'disabled':null,'click':ui.createHandlerFn(this,function(){return callBearQualify().then(function(r){if(!r||!r.ok)throw new Error((r&&r.reason)||'check_failed');return self.refreshBearhole(true);});})},_('Перепроверить маршруты'));
		var details=E('a',{'class':'cbi-button','href':L.url('admin/services/podkop-bot/transport/bearhole')},_('Подробнее'));
		var state=running?(st.state==='ready'?dot('green',_('Работает')):dot('yellow',_('Запущен'))):(enabled?dot('yellow',_('Запускается')):dot('grey',_('Выключен')));
		var progress=E('span',{}),total=parseInt(st.progress_total||0,10)||0,done=parseInt(st.progress_done||0,10)||0,label=st.progress_label||st.progress_route||'';
		if(st.probing){var text=_('Проверяю маршруты');if(total)text+=' · '+Math.min(done+1,total)+' / '+total;if(label)text+=' · '+label;progress=E('div',{'style':'margin:.55em 0;color:#e8a33d;'},[dot('yellow',text),E('progress',{'max':'100','value':String(total?Math.min(100,Math.round(done*100/total)):10),'style':'width:100%;display:block;margin-top:.35em;'})]);}
		var problem=this._bearError||engineReason(st);
		return E('div',{'class':'cbi-section pb-card','style':'max-width:820px;'},[
			E('h3',{'style':'margin-top:0;'},_('OpenWrt Bearhole')),
			E('p',{'class':'pb-muted'},_('Аварийный системный прокси OpenWrt. Нажмите «Запустить Bearhole»: он сам проверит цепочку, выберет рабочий маршрут и включит шлюз 127.0.0.1:1066. LAN и правила Podkop/Forkop не меняются.')),
			this.row(_('Состояние'),state),
			this.row(_('Рабочий маршрут'),E('span',{},st.route_label||st.route_id||'—')),
			progress,
			problem?E('div',{'style':'margin:.5em 0;color:#cc2b2b;'},dot('red',problem)):E('span',{}),
			E('div',{'style':'display:flex;gap:.5em;flex-wrap:wrap;margin-top:.7em;'},[enabled?stop:start,running?check:E('span',{}),details])
		]);
	},

	renderTiers:function(tiers,d){
		var node=base.renderTiers.call(this,tiers,d),spans=node.querySelectorAll?node.querySelectorAll('span'):[];
		for(var i=0;i<spans.length;i++){
			var t=spans[i].textContent||'';
			if(t==='SYSTEM VALID')spans[i].textContent='OpenWrt ✓';
			else if(t==='SYSTEM DEGRADED')spans[i].textContent=_('OpenWrt частично');
			else if(t==='SYSTEM FAIL')spans[i].textContent='OpenWrt ✕';
		}
		return node;
	},

	addFbRow:function(){
		return E('details',{'style':'margin-top:.8em;padding-top:.7em;border-top:1px solid rgba(127,127,127,.12);'},[
			E('summary',{'style':'cursor:pointer;font-weight:600;'},_('Подсказка: редактирование и включение')),
			E('div',{'style':'color:#888;font-size:85%;margin-top:.65em;line-height:1.7;'},[
				E('div',{},_('Не все уровни цепочки редактируются вручную:')),
				E('div',{'style':'padding-left:.6em;margin-top:.25em;'},[
					E('div',{},_('• Podkop SOCKS5 (tier1): ✎ изменить порт Mixed Proxy; если он выключен — включить Mixed Proxy.')),
					E('div',{},_('• section_*: Mixed Proxy других секций обнаруживаются автоматически и доступны только для чтения.')),
					E('div',{},_('• Резервные прокси (tier2): ✎ изменить · ↑ ↓ порядок перебора · ✕ удалить.')),
					E('div',{},_('• Свой прокси (tier3): ✎ задать или изменить.')),
					E('div',{},_('• WARP Rescue: появляется автоматически, когда WARPSCOUT установлен, учётная запись готова и Rescue включён.')),
					E('div',{},_('• Прямой выход WAN (tier4): ⚙ выбрать интерфейс привязки.')),
					E('div',{},_('• Аварийные IP Telegram (tier5): не редактируются.'))
				]),
				E('div',{'style':'margin-top:.55em;'},_('Для резервного прокси тип, хост, порт, логин, пароль и мнемоника вводятся отдельными полями.'))
			])
		]);
	}
});
