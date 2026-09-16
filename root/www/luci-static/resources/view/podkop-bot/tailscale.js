'use strict';
'require view';
'require rpc';
'require dom';
'require ui';

var callStatus = rpc.declare({ object:'podkop_bot_tailscale', method:'status' });
var callCreate = rpc.declare({ object:'podkop_bot_tailscale', method:'create', params:['control_url','auth_key','hostname','advertise_exit_node','confirm_standalone'] });
var callSetEnabled = rpc.declare({ object:'podkop_bot_tailscale', method:'set_enabled', params:['enabled','confirm_standalone'] });
var callDelete = rpc.declare({ object:'podkop_bot_tailscale', method:'delete', params:['purge_state'] });

function row(k,v){return E('div',{'style':'display:grid;grid-template-columns:minmax(180px,34%) 1fr;gap:.7em;padding:.32em 0;'},[E('strong',{},k),E('span',{},[v])]);}
function badge(ok,yes,no){return E('span',{'style':'font-weight:600;'},ok?yes:no);}
function providerName(p){return ({'forkop-native':'Forkop (native Servers)','forkop-x':'Forkop X (safe overlay)','podkop':'Podkop (safe overlay)'})[p]||p||'—';}
function errText(r){var m={provider_missing:_('Podkop/Forkop не найден'),tailscale_unsupported:_('этот sing-box не поддерживает Tailscale/tsnet'),already_configured:_('Tailscale уже настроен'),not_configured:_('Tailscale не настроен'),bad_control_url:_('некорректный URL контрол-сервера'),bad_hostname:_('некорректное имя узла'),auth_key_required:_('нужен pre-auth key'),bad_auth_key:_('некорректный ключ'),standalone_tailscale_running:_('уже работает standalone Tailscale/tailscaled'),uci_write_failed:_('не удалось сохранить UCI'),state_write_failed:_('не удалось сохранить состояние tsnet'),restart_failed:_('не удалось применить native Forkop endpoint; изменение отменено'),disable_failed:_('не удалось безопасно выключить endpoint')};return m[r]||r||'?';}
function standaloneConfirm(){return confirm(_('На роутере уже работает отдельный Tailscale (tailscaled). Встроенный tsnet sing-box создаст второй самостоятельный узел. Это допустимо, но может привести к пересекающимся маршрутам.\n\nПродолжить всё равно?'));}

return view.extend({
	load:function(){return callStatus().catch(function(){return {ok:false,rpc_error:true};});},
	render:function(st){this.root=E('div',{});dom.content(this.root,this.body(st));return this.root;},
	refresh:function(){var self=this;return callStatus().then(function(st){dom.content(self.root,self.body(st));});},
	body:function(st){
		if(!st||st.rpc_error)return E('div',{},[E('h2',{},_('Tailscale')),E('div',{'class':'alert-message error'},_('Backend Tailscale недоступен.'))]);
		var head=[E('h2',{},_('Tailscale / tsnet')),
			E('div',{'class':'cbi-section','style':'max-width:850px;'},[
				E('p',{},_('sing-box может содержать встроенный клиент Tailscale (tsnet). Для удалённого доступа к SSH, LuCI и сервисам роутера это обычно дешевле и проще отдельного tailscaled: не нужен второй постоянно работающий демон и отдельный Tailscale-пакет.')),
				E('p',{'class':'description'},_('Полный Forkop хранит узел штатно в «Серверах». Для Forkop X и классического Podkop используется fail-open overlay поверх сгенерированного sing-box JSON: базовые файлы и UCI этих проектов не патчатся, а ошибка Tailscale не должна мешать их запуску. В этой версии настраивается только подключение к tailnet — маршрутизация Tailscale-трафика не изменяется.'))
			])];
		if(st.provider&&st.provider!=='none')head.push(E('p',{'style':'max-width:850px;'},[E('strong',{},_('Интеграция: ')),providerName(st.provider)]));
		if(st.standalone_tailscale_present)head.push(E('div',{'class':'alert-message '+(st.standalone_tailscale_running?'warning':'notice'),'style':'max-width:850px;'},st.standalone_tailscale_running?_('Обнаружен и запущен standalone Tailscale/tailscaled. Создание или включение встроенного tsnet потребует отдельного подтверждения.'):_('Standalone Tailscale установлен, но сейчас остановлен. Встроенный tsnet можно использовать без конфликта.')));
		if(!st.provider||st.provider==='none'){head.push(E('div',{'class':'alert-message warning','style':'max-width:850px;'},_('Не найден поддерживаемый Podkop/Forkop.')));return E('div',{},head);}
		if(!st.tailscale_supported){head.push(E('div',{'class':'alert-message warning','style':'max-width:850px;'},[_('Установленный sing-box не поддерживает Tailscale. sing-box-tiny сразу считается несовместимым; extended — совместимым; standard/full проверяется один раз и результат кэшируется. '),E('code',{},st.singbox_version||'') ]));return E('div',{},head);}
		head.push(st.configured?this.statusCard(st):this.createCard(st));return E('div',{},head);
	},
	createCard:function(st){
		var self=this,status=E('div',{'style':'margin-top:.7em;'}),host=E('input',{'class':'cbi-input-text','type':'text','placeholder':'router-home','style':'width:100%;max-width:480px;'}),url=E('input',{'class':'cbi-input-text','type':'url','value':'https://controlplane.tailscale.com','style':'width:100%;max-width:620px;'}),key=E('input',{'class':'cbi-input-password','type':'password','autocomplete':'new-password','style':'width:100%;max-width:620px;'});
		function runCreate(confirmStandalone){btn.disabled=true;dom.content(status,E('em',{},_('Сохраняю узел…')));return callCreate(url.value,key.value,host.value,false,!!confirmStandalone).then(function(r){if(r&&r.reason==='standalone_tailscale_running'&&r.requires_confirmation){btn.disabled=false;if(!standaloneConfirm())return;return runCreate(true);}if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));btn.disabled=false;});}
		var btn=E('button',{'class':'cbi-button cbi-button-action','click':ui.createHandlerFn(this,function(){if(st&&st.standalone_tailscale_running){if(!standaloneConfirm())return;return runCreate(true);}return runCreate(false);})},_('Создать Tailscale endpoint'));
		return E('div',{'class':'cbi-section','style':'max-width:850px;'},[E('h3',{},_('Новый узел')),E('p',{'class':'description'},_('Сначала создаётся выключенным. После проверки параметров нажмите «Подключить к tailnet».')),
			row(_('Hostname'),host),row(_('Контрол-сервер'),url),row(_('Pre-auth key'),key),E('p',{'class':'description'},_('Pre-auth key сохраняется локально с ограниченными правами и не показывается обратно в LuCI.')),
			E('div',{'style':'margin-top:1em;'},[btn]),status]);
	},
	statusCard:function(st){
		var self=this,status=E('div',{'style':'margin-top:.8em;'}),purge=E('input',{'type':'checkbox'});
		function setPower(enable,confirmStandalone){power.disabled=true;return callSetEnabled(enable,!!confirmStandalone).then(function(r){if(r&&r.reason==='standalone_tailscale_running'&&r.requires_confirmation){power.disabled=false;if(!standaloneConfirm())return;return setPower(enable,true);}if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));power.disabled=false;});}
		var power=E('button',{'class':'cbi-button '+(st.enabled?'cbi-button-negative':'cbi-button-positive'),'click':ui.createHandlerFn(this,function(){var enable=!st.enabled;if(enable&&st.standalone_tailscale_running){if(!standaloneConfirm())return;return setPower(true,true);}return setPower(enable,false);})},st.enabled?_('Отключить Tailscale'):_('Подключить к tailnet'));
		var del=E('button',{'class':'cbi-button cbi-button-negative','click':ui.createHandlerFn(this,function(){if(!confirm(_('Удалить управляемый Tailscale endpoint?')))return;del.disabled=true;return callDelete(purge.checked).then(function(r){if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));del.disabled=false;});})},_('Удалить endpoint'));
		var auth=st.auth_url?E('a',{'href':st.auth_url,'target':'_blank','rel':'noreferrer noopener'},_('Открыть авторизацию')):E('span',{},'—');
		return E('div',{'class':'cbi-section','style':'max-width:850px;'},[E('h3',{},_('Узел Tailscale')),row(_('Интеграция'),providerName(st.provider)),row(_('Endpoint'),E('code',{},st.section||'—')),row(_('Hostname'),E('code',{},st.hostname||'—')),row(_('Контрол-сервер'),E('code',{},st.control_url||'—')),row(_('Состояние'),badge(st.enabled,_('включён'),_('выключен'))),row(_('tsnet identity'),badge(st.registered,_('создан'),_('ещё не создан'))),row(_('Standalone Tailscale'),badge(st.standalone_tailscale_running,_('запущен'),st.standalone_tailscale_present?_('установлен, остановлен'):_('не обнаружен'))),row(_('URL авторизации'),auth),E('div',{'style':'margin:.8em 0 1.1em;'},[power]),E('hr'),E('p',{'class':'description'},st.integration==='native'?_('При удалении native endpoint сначала выключается штатно через Forkop. Identity по умолчанию сохраняется.'):_('Overlay удаляется отдельно от Podkop/Forkop X. Их базовый конфиг и UCI не удаляются и не изменяются. Identity по умолчанию сохраняется.')),E('label',{},[purge,' ',_('также удалить локальный tsnet identity (следующая регистрация будет новым узлом)')]),E('div',{'style':'margin-top:.8em;'},[del]),status]);
	}
});
