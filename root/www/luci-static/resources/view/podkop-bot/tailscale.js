'use strict';
'require view';
'require rpc';
'require dom';
'require ui';

var callStatus = rpc.declare({ object:'podkop_bot_tailscale', method:'status' });
var callCreate = rpc.declare({ object:'podkop_bot_tailscale', method:'create', params:['control_url','auth_key','hostname','accept_routes','advertise_exit_node','confirm_standalone'] });
var callSetEnabled = rpc.declare({ object:'podkop_bot_tailscale', method:'set_enabled', params:['enabled','confirm_standalone'] });
var callSetAccept = rpc.declare({ object:'podkop_bot_tailscale', method:'set_accept_routes', params:['enabled'] });
var callSetAdvertise = rpc.declare({ object:'podkop_bot_tailscale', method:'set_advertise_exit_node', params:['enabled'] });
var callDelete = rpc.declare({ object:'podkop_bot_tailscale', method:'delete', params:['purge_state'] });

function row(k,v){return E('div',{'style':'display:grid;grid-template-columns:minmax(190px,34%) 1fr;gap:.7em;padding:.32em 0;'},[E('strong',{},k),E('span',{},[v])]);}
function yesno(v){return E('span',{'style':'font-weight:600;'},v?_('да'):_('нет'));}
function providerName(p){return ({'forkop-native':'Forkop (native Servers)','forkop-x':'Forkop X (safe overlay)','podkop':'Podkop (safe overlay)'})[p]||p||'—';}
function errText(r){var m={provider_missing:_('Podkop/Forkop не найден'),tailscale_unsupported:_('этот sing-box не поддерживает Tailscale/tsnet'),already_configured:_('Tailscale уже настроен'),not_configured:_('Tailscale не настроен'),bad_control_url:_('некорректный URL контрол-сервера'),bad_hostname:_('некорректное имя узла'),auth_key_required:_('нужен pre-auth key'),bad_auth_key:_('некорректный ключ'),bad_accept_routes_value:_('некорректное значение accept routes'),standalone_tailscale_running:_('уже работает standalone Tailscale/tailscaled'),uci_write_failed:_('не удалось сохранить UCI'),state_write_failed:_('не удалось сохранить состояние tsnet'),restart_failed:_('не удалось применить native Forkop endpoint; изменение отменено'),disable_failed:_('не удалось безопасно выключить endpoint')};return m[r]||r||'?';}
function standaloneConfirm(){return confirm(_('На роутере уже работает отдельный Tailscale (tailscaled). Встроенный tsnet sing-box создаст второй самостоятельный узел. Продолжить?'));}
function runtimeLabel(st){var m={unconfigured:_('не настроен'),disabled:_('выключен'),starting:_('запускается / ожидает регистрации'),ready:_('готов, активных соединений сейчас нет'),active:_('активен — есть Tailscale-трафик'),degraded:_('endpoint не применён'),failed:_('sing-box не работает')};return m[st.runtime_state]||st.runtime_state||_('неизвестно');}

return view.extend({
	load:function(){return callStatus().catch(function(){return {ok:false,rpc_error:true};});},
	render:function(st){this.root=E('div',{});dom.content(this.root,this.body(st));return this.root;},
	refresh:function(){var self=this;return callStatus().then(function(st){dom.content(self.root,self.body(st));});},
	body:function(st){
		if(!st||st.rpc_error)return E('div',{},[E('h2',{},_('Tailscale')),E('div',{'class':'alert-message error'},_('Backend Tailscale недоступен.'))]);
		var head=[E('h2',{},_('Tailscale / tsnet')),E('div',{'class':'cbi-section','style':'max-width:850px;'},[E('p',{},_('Встроенное Tailscale-подключение работает внутри sing-box без отдельного tailscaled.')),E('p',{'class':'description'},_('Полный Forkop хранит endpoint штатно. Для Forkop X и Podkop используется отдельный overlay, не изменяющий их UCI и исходный конфиг.'))])];
		if(st.provider&&st.provider!=='none')head.push(E('p',{'style':'max-width:850px;'},[E('strong',{},_('Интеграция: ')),providerName(st.provider)]));
		if(st.standalone_tailscale_present)head.push(E('div',{'class':'alert-message '+(st.standalone_tailscale_running?'warning':'notice'),'style':'max-width:850px;'},st.standalone_tailscale_running?_('Уже работает отдельный tailscaled. Включение встроенного tsnet потребует подтверждения.'):_('Standalone Tailscale установлен, но остановлен.')));
		if(!st.provider||st.provider==='none'){head.push(E('div',{'class':'alert-message warning','style':'max-width:850px;'},_('Не найден поддерживаемый Podkop/Forkop.')));return E('div',{},head);}
		if(!st.tailscale_supported){head.push(E('div',{'class':'alert-message warning','style':'max-width:850px;'},_('Установленный sing-box не поддерживает Tailscale.')));return E('div',{},head);}
		head.push(st.configured?this.statusCard(st):this.createCard(st));return E('div',{},head);
	},
	createCard:function(st){
		var self=this,status=E('div',{'style':'margin-top:.7em;'}),host=E('input',{'class':'cbi-input-text','type':'text','placeholder':'router-home','style':'width:100%;max-width:480px;'}),url=E('input',{'class':'cbi-input-text','type':'url','value':'https://controlplane.tailscale.com','style':'width:100%;max-width:620px;'}),key=E('input',{'class':'cbi-input-password','type':'password','autocomplete':'new-password','style':'width:100%;max-width:620px;'}),accept=E('input',{'type':'checkbox'}),adv=E('input',{'type':'checkbox'});
		function runCreate(confirmStandalone){btn.disabled=true;dom.content(status,E('em',{},_('Сохраняю узел…')));return callCreate(url.value,key.value,host.value,accept.checked,adv.checked,!!confirmStandalone).then(function(r){if(r&&r.reason==='standalone_tailscale_running'&&r.requires_confirmation){btn.disabled=false;if(!standaloneConfirm())return;return runCreate(true);}if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));btn.disabled=false;});}
		var btn=E('button',{'class':'cbi-button cbi-button-action','click':ui.createHandlerFn(this,function(){if(st&&st.standalone_tailscale_running){if(!standaloneConfirm())return;return runCreate(true);}return runCreate(false);})},_('Создать Tailscale-подключение'));
		return E('div',{'class':'cbi-section','style':'max-width:850px;'},[E('h3',{},_('Новое подключение')),E('p',{'class':'description'},_('Создаётся выключенным. После сохранения нажмите «Подключить к tailnet».')),row(_('Hostname'),host),row(_('Контрол-сервер'),url),row(_('Pre-auth key'),key),E('p',{'class':'description'},_('Ключ сохраняется локально с правами 0600 и не показывается в LuCI.')),E('label',{},[accept,' ',_('Принимать маршруты, объявленные другими узлами tailnet')]),E('br'),E('label',{},[adv,' ',_('Анонсировать этот роутер как exit node')]),E('div',{'style':'margin-top:1em;'},[btn]),status]);
	},
	statusCard:function(st){
		var self=this,status=E('div',{'style':'margin-top:.8em;'}),purge=E('input',{'type':'checkbox'});
		function setPower(enable,confirmStandalone){power.disabled=true;return callSetEnabled(enable,!!confirmStandalone).then(function(r){if(r&&r.reason==='standalone_tailscale_running'&&r.requires_confirmation){power.disabled=false;if(!standaloneConfirm())return;return setPower(enable,true);}if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));power.disabled=false;});}
		function setOpt(call,value){return call(value).then(function(r){if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));});}
		var power=E('button',{'class':'cbi-button '+(st.enabled?'cbi-button-negative':'cbi-button-positive'),'click':ui.createHandlerFn(this,function(){var enable=!st.enabled;if(enable&&st.standalone_tailscale_running){if(!standaloneConfirm())return;return setPower(true,true);}return setPower(enable,false);})},st.enabled?_('Отключить Tailscale'):_('Подключить к tailnet'));
		var acceptBtn=E('button',{'class':'cbi-button','click':ui.createHandlerFn(this,function(){return setOpt(callSetAccept,!st.accept_routes);})},st.accept_routes?_('Не принимать маршруты'):_('Принимать маршруты'));
		var advBtn=E('button',{'class':'cbi-button','click':ui.createHandlerFn(this,function(){return setOpt(callSetAdvertise,!st.advertise_exit_node);})},st.advertise_exit_node?_('Не быть exit node'):_('Анонсировать exit node'));
		var del=E('button',{'class':'cbi-button cbi-button-negative','click':ui.createHandlerFn(this,function(){if(!confirm(_('Удалить встроенное Tailscale-подключение? Настройки Forkop X / Podkop и остальные прокси не изменятся.')))return;del.disabled=true;return callDelete(purge.checked).then(function(r){if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));del.disabled=false;});})},_('Удалить подключение'));
		var auth=st.auth_url?E('a',{'href':st.auth_url,'target':'_blank','rel':'noreferrer noopener'},_('Открыть авторизацию')):E('span',{},'—');
		var peers=(st.active_peers&&st.active_peers.length)?st.active_peers.join(', '):'—';
		return E('div',{'class':'cbi-section','style':'max-width:850px;'},[E('h3',{},_('Узел Tailscale')),row(_('Состояние'),E('strong',{},runtimeLabel(st))),row(_('Hostname'),E('code',{},st.hostname||'—')),row(_('Контрол-сервер'),E('code',{},st.control_url||'—')),row(_('Endpoint применён'),yesno(!!st.runtime_applied)),row(_('sing-box работает'),yesno(!!st.singbox_running)),row(_('Identity создана'),yesno(!!st.registered)),row(_('Активных соединений'),String(st.active_connections||0)),row(_('Активные peer'),E('code',{},peers)),row(_('Принимать маршруты'),yesno(!!st.accept_routes)),row(_('Анонсировать exit node'),yesno(!!st.advertise_exit_node)),row(_('URL авторизации'),auth),E('div',{'style':'margin:.8em 0 1.1em;display:flex;gap:.6em;flex-wrap:wrap;'},[power,acceptBtn,advBtn]),E('details',{},[E('summary',{},_('Технические детали')),row(_('Интеграция'),providerName(st.provider)),row(_('Endpoint'),E('code',{},st.section||'—'))]),E('hr'),E('h4',{},_('Удаление')),E('p',{'class':'description'},_('Удалит встроенное Tailscale-подключение из sing-box. Настройки Forkop X / Podkop и остальные прокси не изменяются. По умолчанию локальная identity сохраняется, поэтому при повторной настройке роутер сможет вернуться как тот же узел.')),E('label',{},[purge,' ',_('Также забыть этот Tailscale-узел на роутере. При следующем подключении будет создана новая identity.')]),E('div',{'style':'margin-top:.8em;'},[del]),status]);
	}
});
