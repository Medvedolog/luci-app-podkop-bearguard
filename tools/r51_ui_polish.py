from pathlib import Path

# Bearhole: keep Releases removed and center the final Checked column.
p=Path('root/www/luci-static/resources/view/podkop-bot/bearhole.js')
s=p.read_text()
s=s.replace("E('td',{'style':'white-space:nowrap;text-align:right;padding-right:1.2em;'},age(x.checked_at))", "E('td',{'style':'white-space:nowrap;text-align:center;'},age(x.checked_at))")
s=s.replace("E('th',{'style':'text-align:right;padding-right:1.2em;'},_('Проверено'))", "E('th',{'style':'text-align:center;white-space:nowrap;'},_('Проверено'))")
p.write_text(s)

# Revolver: humorous stage text tied to real backend states.
p=Path('root/www/luci-static/resources/view/podkop-bot/warpscout-rescue.js')
s=p.read_text()
old="var phase={manual:_('этап 1/4 · подготовка'),discovery:_('этап 1/4 · поиск WARP-узлов'),qualification:_('этап 2/4 · проверка Telegram API'),building:_('этап 3/4 · сбор магазина')};"
new="var phase={manual:_('открываю барабан · готовлюсь к перезарядке'),discovery:_('ищу патроны · Discovery WARP-узлов'),qualification:_('проверяю капсюли · Telegram API qualification'),building:_('заряжаю магазин · укладываю только VALID')};"
if old not in s: raise SystemExit('phase anchor not found')
s=s.replace(old,new,1)
old="busyLabel=_('Запуск WARP')+' · '+String(rs.index||0)+' / '+String(rs.total||0)+' · '+_('SOCKS → Telegram getMe');"
new="busyLabel=_('Взвожу курок')+' · '+String(rs.index||0)+' / '+String(rs.total||0)+' · '+_('тестовый отстрел: SOCKS → Telegram getMe');"
if old not in s: raise SystemExit('firing anchor not found')
s=s.replace(old,new,1)
old="return E('span',{'class':'pb-mag-load','title':_('Магазин перезаряжается'),'aria-label':_('Магазин перезаряжается')},[E('span',{'class':'pb-mag-load-cells'},cells),E('span',{'class':'pb-mag-load-text'},_('заряжаю магазин…'))]);"
new="return E('span',{'class':'pb-mag-load','title':_('Магазин перезаряжается'),'aria-label':_('Магазин перезаряжается')},[E('span',{'class':'pb-mag-load-cells'},cells),E('span',{'class':'pb-mag-load-text'},_('патроны в барабан…'))]);"
if old not in s: raise SystemExit('loader text anchor not found')
s=s.replace(old,new,1)
p.write_text(s)
