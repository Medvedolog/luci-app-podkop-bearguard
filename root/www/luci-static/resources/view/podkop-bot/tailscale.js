'use strict';
'require view';
'require rpc';
'require dom';
'require ui';

var callStatus = rpc.declare({ object:'podkop_bot_tailscale', method:'status' });
var callCreate = rpc.declare({ object:'podkop_bot_tailscale', method:'create', params:['control_url','auth_key','hostname','advertise_exit_node'] });
var callSetEnabled = rpc.declare({ object:'podkop_bot_tailscale', method:'set_enabled', params:['enabled'] });
var callSetAdvertise = rpc.declare({ object:'podkop_bot_tailscale', method:'set_advertise_exit_node', params:['enabled'] });
var callDelete = rpc.declare({ object:'podkop_bot_tailscale', method:'delete', params:['purge_state'] });

function row(k,v){return E('div',{'style':'display:grid;grid-template-columns:minmax(180px,34%) 1fr;gap:.7em;padding:.32em 0;'},[E('strong',{},k),E('span',{},[v])]);}
function badge(ok,yes,no){return E('span',{'style':'font-weight:600;'},ok?yes:no);}
function errText(r){var m={forkop_missing:_('Forkop не установлен'),tailscale_unsupported:_('этот sing-box не собран с поддержкой Tailscale/tsnet'),already_configured:_('Tailscale уже настроен'),not_configured:_('Tailscale не настроен'),bad_control_url:_('некорректный URL контрол-сервера'),bad_hostname:_('некорректное имя узла'),auth_key_required:_('нужен pre-auth key'),bad_auth_key:_('некорректный ключ'),uci_write_failed:_('не удалось сохранить UCI'),restart_failed:_('Forkop не перезапустился; изменение отменено'),disable_failed:_('не удалось безопасно выключить endpoint; удаление отменено'),delete_failed:_('не удалось удалить секцию; изменение отменено')};return m[r]||r||'?';}

return view.extend({
	load:function(){return callStatus().catch(function(){return {ok:false,rpc_error:true};});},
	render:function(st){this.root=E('div',{});dom.content(this.root,this.body(st));return this.root;},
	refresh:function(){var self=this;return callStatus().then(function(st){dom.content(self.root,self.body(st));});},
	body:function(st){
		if(!st||st.rpc_error)return E('div',{},[E('h2',{},_('Tailscale')),E('div',{'class':'alert-message error'},_('Backend Tailscale недоступен.'))]);
		var head=[E('h2',{},_('Tailscale / tsnet')),E('p',{'class':'description','style':'max-width:850px;'},_('Управление встроенным Tailscale endpoint в sing-box через Forkop. LuCI и Telegram-бот используют одну и ту же UCI-секцию, поэтому изменения видны в обоих интерфейсах.'))];
		if(!st.forkop_present){head.push(E('div',{'class':'alert-message warning','style':'max-width:850px;'},_('Forkop не найден. Эта страница ничего не меняет в Podkop/Podkop Plus.')));return E('div',{},head);}
		if(!st.tailscale_supported){head.push(E('div',{'class':'alert-message warning','style':'max-width:850px;'},[_('Установленный sing-box не сообщает поддержку Tailscale. Нужен sing-box extended либо сборка с with_tailscale. '),E('code',{},st.singbox_version||'') ]));return E('div',{},head);}
		head.push(st.configured?this.statusCard(st):this.createCard());return E('div',{},head);
	},
	createCard:function(){
		var self=this,status=E('div',{'style':'margin-top:.7em;'}),host=E('input',{'class':'cbi-input-text','type':'text','placeholder':'router-home','style':'width:100%;max-width:480px;'}),url=E('input',{'class':'cbi-input-text','type':'url','value':'https://controlplane.tailscale.com','style':'width:100%;max-width:620px;'}),key=E('input',{'class':'cbi-input-password','type':'password','autocomplete':'new-password','style':'width:100%;max-width:620px;'}),adv=E('input',{'type':'checkbox'});
		var btn=E('button',{'class':'cbi-button cbi-button-action','click':ui.createHandlerFn(this,function(){
			btn.disabled=true;dom.content(status,E('em',{},_('Сохраняю секцию…')));
			return callCreate(url.value,key.value,host.value,adv.checked).then(function(r){if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));btn.disabled=false;});
		})},_('Создать Tailscale endpoint'));
		return E('div',{'class':'cbi-section','style':'max-width:850px;'},[E('h3',{},_('Новый узел')),E('p',{'class':'description'},_('Создаётся выключенным, как и в Telegram-боте. Это не перезапускает Forkop до нажатия «Подключить к tailnet».')),
			row(_('Hostname'),host),row(_('Контрол-сервер'),url),row(_('Pre-auth key'),key),row(_('Анонсировать как exit node'),E('label',{},[adv,' ',_('да')])),
			E('p',{'class':'description'},_('Ключ сохраняется в UCI Forkop, но LuCI не считывает и не показывает его обратно.')),
			E('div',{'style':'margin-top:1em;'},[btn]),status]);
	},
	statusCard:function(st){
		var self=this,status=E('div',{'style':'margin-top:.8em;'}),adv=E('input',{'type':'checkbox','checked':st.advertise_exit_node?'checked':null}),purge=E('input',{'type':'checkbox'});
		var power=E('button',{'class':'cbi-button '+(st.enabled?'cbi-button-negative':'cbi-button-positive'),'click':ui.createHandlerFn(this,function(){power.disabled=true;return callSetEnabled(!st.enabled).then(function(r){if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));power.disabled=false;});})},st.enabled?_('Отключить Tailscale'):_('Подключить к tailnet'));
		var saveAdv=E('button',{'class':'cbi-button','click':ui.createHandlerFn(this,function(){saveAdv.disabled=true;return callSetAdvertise(adv.checked).then(function(r){if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));saveAdv.disabled=false;});})},_('Применить режим exit node'));
		var del=E('button',{'class':'cbi-button cbi-button-negative','click':ui.createHandlerFn(this,function(){
			if(!confirm(_('Удалить Tailscale endpoint из Forkop?')))return;
			del.disabled=true;return callDelete(purge.checked).then(function(r){if(!r||!r.ok)throw new Error(errText(r&&r.reason));return self.refresh();}).catch(function(e){dom.content(status,E('span',{'style':'color:#b00;'},_('Ошибка: ')+(e.message||e)));del.disabled=false;});
		})},_('Удалить endpoint'));
		var auth=st.auth_url?E('a',{'href':st.auth_url,'target':'_blank','rel':'noreferrer noopener'},_('Открыть авторизацию')):E('span',{},'—');
		return E('div',{'class':'cbi-section','style':'max-width:850px;'},[E('h3',{},_('Узел Tailscale')),
			row(_('UCI-секция'),E('code',{},st.section||'—')),row(_('Hostname'),E('code',{},st.hostname||'—')),row(_('Контрол-сервер'),E('code',{},st.control_url||'—')),
			row(_('Endpoint'),badge(st.enabled,_('включён'),_('выключен'))),row(_('Состояние tsnet'),badge(st.registered,_('state зарегистрирован'),_('state ещё не создан'))),row(_('URL авторизации'),auth),
			E('div',{'style':'margin:.8em 0 1.1em;'},[power]),E('hr'),
			row(_('Exit node'),E('label',{},[adv,' ',_('анонсировать этот роутер как exit node')])),E('div',{'style':'margin:.5em 0 1em;'},[saveAdv]),
			E('hr'),E('p',{'class':'description'},_('При удалении включённый endpoint сначала безопасно выключается и Forkop перезапускается. State по умолчанию сохраняется.')),
			E('label',{},[purge,' ',_('также удалить локальный tsnet state (повторная регистрация будет новым узлом)')]),E('div',{'style':'margin-top:.8em;'},[del]),status]);
	}
});
