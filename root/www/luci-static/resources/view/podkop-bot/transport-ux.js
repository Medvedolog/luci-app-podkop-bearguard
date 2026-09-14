'use strict';
'require view.podkop-bot.transport as base';

/* Keep the route list operational and compact. Detailed editing semantics are
 * useful, but should not permanently consume vertical space on every visit. */
return base.constructor.extend({
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
