# Forkop 2.0 / Podkop Experimental 0.8.x compatibility: RC work

This branch introduces *fail-closed compatibility*, not full feature parity.

## Confirmed upstream changes

- Forkop 2.0 migrates per-section `mixed_proxy_*` to `server` (`protocol=mixed`, `routing_mode=section`), and Tailscale native options to `tunnel` (`kind=tailscale`).
- Forkop 2 uses `sing-box-forkop` and its own package version compatibility checks.
- Podkop Experimental installs `podkop-exp`, preserves `/etc/config/podkop`, and embeds sing-box in its Go backend. The upstream installer may remove incompatible packages with explicit consent.

## Included safety changes

1. Detect these backends from installed package and UCI version, not just stale filenames.
2. Read Forkop 2 mixed listeners from routed `server` records in status, runtime sections and transport.
3. The Wizard (step 2), Settings and Transport can create/enable Forkop mixed proxies. For Forkop 2.0 they use a native routed `server`, for Forkop 1.x its legacy section options. Target is the first enabled `action=connection` section. Begin at port 2080; skip configured listeners and occupied TCP/UDP sockets, selecting the next free port up to 2280. Idempotent; backup/rollback on failed service reload. Unrelated UCI settings are preserved.
4. Legacy direct Mixed Proxy port-editor operations remain disabled for Forkop 2.0; the native server helper is a narrowly scoped exception.
5. For NetShift, Podkop stable/Evolution and Podkop Experimental, Wizard and Settings explain how to enable the native Mixed Proxy checkbox manually.
6. Read-only native Tailscale detection for Forkop 2. Mutating legacy `server` records is denied. Podkop Experimental has no external JSON Tailscale overlay.
7. Refuse unattended Experimental updates and use the native Forkop 2 installer logic for core upgrades.
8. Show embedded/packaged core identity without launching a second Go process, and sync embedded Telegram bot.

## Known gaps / do not enable yet

- Full editing of Forkop 2 subscriptions, priorities, tunnels and DNS through the legacy Telegram/LuCI editor.
- Forkop 2 native Tailscale create/delete/update, and `server_client` credential handling.
- Physical tests of Mixed Proxy on free/busy 2080, existing disabled server, invalid UCI/reload rollback, routing, failover and safe upgrade over proxy-only WAN.

## Verify source-level guards

```sh
sh tools/check-provider-compat.sh
sh tools/test-forkop2-mixed-port.sh
sh tools/check-async-wrappers.sh
```

Do not mark this branch stable or merge until hardware regression tests pass.

## Подробное исследование API и UCI

См. [FORKOP2_PODKOP_EXP_API_RESEARCH.md](FORKOP2_PODKOP_EXP_API_RESEARCH.md): ubus, Clash API, схема Forkop 2.0 и Podkop Experimental 0.8.x, полевые результаты AX6000, UI прокси, безопасность и план регрессионных тестов.


## Dev6 (2026-11-02): нативный Tailscale-сервер Forkop 2.0

- **Две разные сущности:** `config server` + `protocol=tailscale` регистрирует сам роутер в tailnet, а `config tunnel` + `kind=tailscale` служит исходящим туннелем маршрутизации Forkop. Запрещено подменять одну другой.
- Разрешено *экспериментальное* создание native server **с `enabled=0`**, последующее включение отдельным действием Telegram/BearGuard. Требуется сборка sing-box с `with_tailscale` и `with_gvisor`, подтверждаемая через `ubus call forkop state '{}'` (`capabilities.core.features.tailscale.available`). Не запускать второй Go-процесс для опроса capabilities.
- `tailscale_auth_key`, `tailscale_hostname`, `tailscale_control_url` записываются нативно. Старые поля `tailscale_advertise_exit_node` и `tailscale_accept_routes` для этого сервера Forkop 2 **не пишутся**: ядро само объявляет возможность Exit Node, которую затем нужно одобрить в консоли Tailscale; прием маршрутов настраивается у исходящего туннеля.
- Для Podkop Experimental 0.8.x по-прежнему **запрещена запись Tailscale**: его Go backend нельзя настраивать через форкоповскую схему или внешнее overlay JSON.
- Статус различает `server.protocol=tailscale` и `tunnel.kind=tailscale`; локальный state-файл не является доказательством полноценной регистрации и связности.
- Состояние `dev6` — код и статические тесты, **реальная авторизация и выход в tailnet на OpenWrt не проверены**. Нативный мастер `server.protocol=tailscale` доступен также из standalone `.sh` бота на Forkop 2.0 при подтвержденной capability; LuCI-интеграция и расширенный RPC-статус требуют совместимого BearGuard. Другие движки по-прежнему требуют своего backend.
- Тест: `sh tools/test-forkop2-tailscale-native.sh` (в BearGuard передать путь к встроенному боту). *Старый раздел о нереализованном Tailscale CRUD выше относится к полному управлению туннелями, а не к первичному созданию native server.*
