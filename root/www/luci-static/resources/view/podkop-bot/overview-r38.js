'use strict';
'require view.podkop-bot.overview-r37 as base';
'require dom';

var FORKOP_URL='https://github.com/ushan0v/forkop';

function renderPlusMigration(data){
	if(!data||data.podkop_variant!=='plus')return;
	var cell=document.getElementById('podkop-ver-cell');
	if(!cell)return;
	var version=(data.podkop_version&&data.podkop_version!=='unknown')?data.podkop_version:'—';
	var link=E('a',{
		'href':FORKOP_URL,
		'target':'_blank',
		'rel':'noopener',
		'style':'margin-left:.45em;font-weight:600;color:#e8a33d;text-decoration:none;',
		'title':_('Podkop Plus больше не поддерживается. Продолжение проекта — Forkop.')
	},'🔔 '+_('Forkop'));
	dom.content(cell,[E('span',{},version),link]);
}

return base.constructor.extend({
	render:function(data){
		var node=base.render.call(this,data),self=this;
		window.setTimeout(function(){renderPlusMigration(data);},0);
		/* Base Overview still runs its generic remote update check asynchronously.
		 * For orphaned Plus that result is semantically irrelevant. Re-assert the
		 * migration badge if the generic callback touches the version cell. */
		window.setTimeout(function(){
			if(!data||data.podkop_variant!=='plus')return;
			var cell=document.getElementById('podkop-ver-cell');
			if(!cell)return;
			var obs=new MutationObserver(function(){renderPlusMigration(data);});
			obs.observe(cell,{childList:true,subtree:true});
			window.setTimeout(function(){obs.disconnect();renderPlusMigration(data);},15000);
		},0);
		return node;
	}
});
