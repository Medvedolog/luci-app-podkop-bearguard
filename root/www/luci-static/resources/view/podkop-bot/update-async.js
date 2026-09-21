'use strict';
'require view.podkop-bot.update as base';
'require rpc';
'require ui';
'require dom';

var callPodkopUpdate = rpc.declare({ object:'podkop_bot', method:'podkop_update_check', params:['force'] });
var callPodkopRunAsync = rpc.declare({ object:'podkop_bot_update_async', method:'start' });
var callVendoredStatus = rpc.declare({ object:'podkop_bot_update_async', method:'vendored_status' });
var callVendoredInstall = rpc.declare({ object:'podkop_bot_update_async', method:'vendored_install' });
var callHwelpStatus = rpc.declare({ object:'podkop_bot_update_async', method:'hwelp_status' });
var callHwelpInstall = rpc.declare({ object:'podkop_bot_update_async', method:'hwelp_install' });
var COLOURS={green:'#33a02c',yellow:'#e8a33d',grey:'#888888',red:'#cc2b2b'};
function dot(c,label){return E('span',{'style':'display:inline-flex;align-items:flex-start;gap:.4em;'},[E('span',{'style':'width:.7em;height:.7em;border-radius:50%;display:inline-block;flex:none;margin-top:.28em;background:'+(COLOURS[c]||COLOURS.grey)+';'}),E('span',{},label)]);}
function row(label,value){return E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},label),E('span',{'class':'pb-row-val'},value instanceof Node?value:String(value==null?'—':value))]);}

/* LuCI require() injects the update view instance. Return a subclass constructor
 * so the loader can instantiate this wrapper normally. */
return base.constructor.extend({
	render:function(data){
		var root=base.render.call(this,data),local=this.localComponentsCard();
		/* Order matches the intro paragraph: LuCI, Telegram-bot, Podkop, WARPSCOUT
		 * are the four modules, in that order, so a reader can find any of them
		 * without scrolling past the others. Local/package sources are a fallback
		 * for a blocked GitHub, not one of "the modules" — shown after them,
		 * right before the danger zone. base.render()'s array is
		 * [h2, p, luciCard, botCard, podkopCard, warpscoutCard, dangerZone, footer];
		 * index 6 is dangerZone. */
		if(root&&root.children&&root.children.length>=7)root.insertBefore(local,root.children[6]||null);
		else root=E('div',{},[root,local]);
		/* A direct link (e.g. "Установка / удаление WARPSCOUT" on the WARP Rescue
		 * settings page) sets location.hash before this view's async load()
		 * resolves, so the browser's own scroll-to-fragment never finds the
		 * target element in time. Do it ourselves once the DOM exists. */
		if(location.hash){
			var id=location.hash.slice(1);
			window.setTimeout(function(){var el=document.getElementById(id);if(el)el.scrollIntoView({block:'start'});},0);
		}
		return root;
	},

	localComponentsCard:function(){
		var self=this;
		var vendoredLine=E('div',{},dot('grey',_('проверяю встроенную копию…'))),vendoredActions=E('div',{'style':'margin-top:.5em;'});
		var hwelpLine=E('div',{},dot('grey',_('проверяю…'))),hwelpActions=E('div',{'style':'margin-top:.5em;'});
		var card=E('div',{'class':'cbi-section','style':'max-width:760px;border:1px solid var(--border-color-medium,rgba(127,127,127,.2));border-radius:8px;padding:1em 1.2em;background:var(--background-color-high,var(--background-color,var(--background,rgba(40,40,40,.94))));margin-top:1em;'},[
			E('h3',{'style':'margin-top:0;'},_('Локальные компоненты пакета')),
			E('p',{'style':'color:#888;font-size:90%;margin:.2em 0 .8em;'},_('Для встроенного бота используется локальная копия пакета. HWELP обновляется автоматически: сначала через owfeed, а при недоступности — из подходящего asset GitHub Releases.')),
			E('strong',{},_('Telegram-бот')),
			vendoredLine,vendoredActions,
			E('div',{'style':'border-top:1px solid rgba(127,127,127,.15);margin:1em 0 .8em;'}),
			E('strong',{},'hwelp proxy'),
			E('p',{'style':'color:#888;font-size:90%;margin:.25em 0 .5em;'},_('Маленький нативный шлюз Bearhole. Он позволяет системным curl/wget/opkg OpenWrt использовать цепочку SOCKS/HTTP/WARP без sing-box внутри самого шлюза. Устанавливается отдельно под архитектуру роутера и нужен только Bearhole.')),
			hwelpLine,hwelpActions
		]);
		this.fillVendored(vendoredLine,vendoredActions);
		this.fillHwelp(hwelpLine,hwelpActions);
		return card;
	},

	fillVendored:function(line,actions){
		var self=this;
		callVendoredStatus().then(function(d){
			if(!d||!d.ok||d.vendored==='unknown'){dom.content(line,dot('grey',_('Встроенная копия бота недоступна')));dom.content(actions,[]);return;}
			if(d.available){
				dom.content(line,dot('yellow',_('В пакете есть более свежий бот: v')+(d.current||'?')+' → v'+d.vendored));
				var status=E('span',{'style':'margin-left:.6em;'}),btn=E('button',{'class':'cbi-button cbi-button-action','click':ui.createHandlerFn(self,function(){btn.disabled=true;dom.content(status,dot('yellow',_('Устанавливаю встроенную копию…')));return callVendoredInstall().then(function(r){if(!r||r.ok===false){dom.content(status,dot('red',_('Не удалось установить встроенную копию')+((r&&r.reason)?(': '+r.reason):'')));btn.disabled=false;return;}dom.content(status,dot('green',_('Бот установлен из пакета. Обновляю страницу…')));window.setTimeout(function(){window.location.reload();},700);}).catch(function(){dom.content(status,dot('red',_('Ошибка установки встроенной копии')));btn.disabled=false;});})},_('Установить встроенную v')+d.vendored);
				dom.content(actions,[btn,status]);
			}else{
				dom.content(line,dot('green',_('Встроенная копия v')+d.vendored+_(' · установленный бот не старее')));
				dom.content(actions,[]);
			}
		}).catch(function(){dom.content(line,dot('grey',_('Не удалось проверить встроенную копию')));});
	},

	fillHwelp:function(line,actions){
		var self=this;
		callHwelpStatus().then(function(d){
			if(!d||!d.ok){dom.content(line,dot('grey',_('Статус hwelp proxy недоступен')));dom.content(actions,[]);return;}
			if(d.installing){dom.content(line,dot('yellow',_('Проверяю источники и устанавливаю hwelp proxy…')));dom.content(actions,[]);window.setTimeout(function(){self.fillHwelp(line,actions);},1200);return;}
			var state=d.installed?(d.ready?dot('green',_('Готов')+(d.version&&d.version!=='unknown'?(' · v'+d.version):'')):dot('red',_('Установлен, но самопроверка не пройдена'))):dot('grey',_('Не установлен'));
			var meta=E('div',{'style':'margin-top:.35em;'},[
				row(_('Архитектура'),d.arch||'—'),
				row(_('Формат пакета'),String(d.format||'—').toUpperCase()),
				row(_('Источники'),_('owfeed → GitHub Releases'))
			]);
			if(d.last_source&&d.last_source!=='unknown')meta.appendChild(row(_('Последняя установка'),d.last_source+(d.last_version&&d.last_version!=='unknown'?(' · v'+d.last_version):'')));
			dom.content(line,[state,meta]);
			var status=E('span',{'style':'margin-left:.6em;'}),btn=E('button',{'class':'cbi-button cbi-button-action','click':ui.createHandlerFn(self,function(){
				btn.disabled=true;dom.content(status,dot('yellow',_('Сначала пробую owfeed, затем GitHub Releases…')));
				return callHwelpInstall().then(function(r){
					if(!r||r.ok===false){dom.content(status,dot('red',_('Не удалось запустить установку')+((r&&r.reason)?(': '+r.reason):'')));btn.disabled=false;return;}
					self.fillHwelp(line,actions);
				}).catch(function(){dom.content(status,dot('red',_('Ошибка запуска установки')));btn.disabled=false;});
			})},d.installed?_('Проверить и обновить HWELP'):_('Установить HWELP'));
			dom.content(actions,[btn,status]);
		}).catch(function(){dom.content(line,dot('grey',_('Статус hwelp proxy недоступен')));dom.content(actions,[]);});
	},

	fillPodkop:function(holder,force){
		var self=this;
		callPodkopUpdate(force).then(function(d){
			var recheck=E('button',{'class':'cbi-button','style':'display:inline-flex;align-items:center;','click':function(){dom.content(holder,E('div',{'class':'cbi-section','style':'max-width:760px;margin-top:1em;'},[E('h3',{},_('Podkop')),dot('grey',_('Проверка…'))]));self.fillPodkop(holder,'true');}},_('Проверить версию'));
			var inner;
			if(!d||!d.ok||d.available===false){
				inner=[E('h3',{'style':'margin-top:0;'},_('Podkop')),dot('grey',_('Не удалось проверить (GitHub недоступен напрямую и через прокси).')),(d&&d.releases_url)?E('div',{'style':'margin-top:.5em;'},[E('a',{'href':d.releases_url,'target':'_blank','rel':'noopener'},_('Открыть релизы'))]):E('span',{}),recheck];
			}else{
				var upd=d.update_available;
				inner=[E('h3',{'style':'margin-top:0;'},d.name||'Podkop'),
					E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},_('Вариант')),E('span',{'class':'pb-row-val'},d.variant||'—')]),
					E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},_('Установлено')),E('span',{'class':'pb-row-val'},d.current||'—')]),
					E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},_('В репозитории')),E('span',{'class':'pb-row-val'},[upd?dot('yellow',(d.latest||'—')+_(' — доступно')):dot('green',(d.latest||'—')+_(' — актуально'))])]),
					E('div',{'class':'pb-row pb-row--plain'},[E('span',{'class':'pb-row-label'},_('Проверено через')),E('span',{'class':'pb-row-val'},d.via==='socks'?_('прокси SOCKS'):(d.via==='direct'?_('напрямую'):'—'))]),
					E('p',{'style':'color:#888;font-size:88%;margin:.5em 0 0;'},_('Проверка сети, загрузка установщика и само обновление выполняются на роутере в фоне. Потеря страницы LuCI не прерывает процесс.')),
					(function(){
						var pkStatus=E('span',{}),pkLog=E('pre',{'class':'pb-mono','style':'display:none;max-width:760px;max-height:260px;overflow:auto;background:var(--background-color-high,var(--background-color,var(--background,rgba(30,30,30,.96))));padding:.6em;border-radius:6px;white-space:pre-wrap;font-size:80%;margin-top:.5em;'}),pkNodes={status:pkStatus,log:pkLog},name=d.name||'Podkop',cls=upd?'cbi-button cbi-button-action':'cbi-button';
						var btn=E('button',{'class':cls,'style':'display:inline-flex;align-items:center;','click':ui.createHandlerFn(self,function(){
							if(!confirm(_('Запустить обновление Podkop? Установщик будет скачан и выполнен от root. Туннель может кратко прерваться.')))return;
							btn.disabled=true;pkLog.style.display='block';dom.content(pkStatus,dot('yellow',_('Запускаю фоновую проверку и обновление…')));
							return callPodkopRunAsync().then(function(r){if(r&&r.ok){self.pollPodkopLog(pkNodes,btn);return;}var m={already_running:_('обновление уже идёт'),download_failed:_('не удалось скачать install.sh'),bad_script:_('скачанный файл не является скриптом'),repos_unreachable:_('репозитории недоступны'),low_disk:_('мало места на диске')};dom.content(pkStatus,dot('red',(m[r&&r.reason]||_('ошибка запуска'))+(r&&r.detail?(' · '+r.detail):'')));btn.disabled=false;}).catch(function(e){dom.content(pkStatus,dot('red',_('ошибка запуска: ')+((e&&e.message)||'?')));btn.disabled=false;});
						})},upd?(_('Обновить ')+name):(_('Обновить ')+name+_(' (актуально)')));if(!upd)btn.disabled=true;
						return E('div',{'style':'margin-top:.5em;'},[E('div',{'class':'pb-action-row','style':'display:flex;gap:.5em;flex-wrap:wrap;align-items:stretch;'},[E('a',{'class':'cbi-button','style':'display:inline-flex;align-items:center;','href':d.releases_url||d.repo_url,'target':'_blank','rel':'noopener'},_('Страница релизов')),recheck,btn]),pkStatus,pkLog]);
					})()
				];
			}
			dom.content(holder,E('div',{'class':'cbi-section','style':'max-width:760px;border:1px solid var(--border-color-medium,rgba(127,127,127,.2));border-radius:8px;padding:1em 1.2em;background:var(--background-color-high,var(--background-color,var(--background,rgba(40,40,40,.94))));margin-top:1em;'},inner));
		}).catch(function(){});
	}
});
