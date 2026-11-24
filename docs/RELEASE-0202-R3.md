## Совместимость

- **Podkop Experimental 0.8.21:** статус встроенного sing-box берётся у Podkop, а не из списка отдельных процессов. Также сохранена совместимость с 0.8.14. При недоступном ubus выводится «неизвестно», а не «остановлен».
- **Forkop 2.0:** исправлены выбор сервера в Selector/Fallback и обновление подписок. Нативный URLTest не переключается вручную.
- Диагностика больше не выгружает сырые конфиги и журналы с потенциальными секретами; данные авторизации прокси исключены из аргументов curl.

Проверено в CI и тестах с фикстурами; **на физическом роутере не проверено**. Это тестовый пререлиз, он не заменяет стабильный выпуск.

## Compatibility

- **Podkop Experimental 0.8.21:** report the embedded sing-box status from Podkop rather than searching for a standalone process. Compatibility with 0.8.14 is retained. An unavailable ubus results in “unknown”, not “stopped”.
- **Forkop 2.0:** fixes Selector/Fallback selection and subscription refresh; native URLTest is not manually switched.
- Diagnostics no longer exports raw configs and logs that may contain secrets. Proxy credentials are not passed as curl arguments.

CI and fixture checks passed; **not tested on a physical router**. This is a prerelease, not a replacement for the stable release.

### Файлы / Assets

`luci-app-podkop-bot-0.20.2-r3.apk` для OpenWrt с APK, `luci-app-podkop-bot_0.20.2-r3_all.ipk` для OpenWrt с opkg. Пакеты тестовые: SHA-256 приложены, штатной подписи стабильного фида у них нет. Бот уже встроен, отдельно его ставить не нужно.

Use the APK on APK-based OpenWrt and the IPK on opkg-based OpenWrt. These are test packages with SHA-256 checksums, not signed stable-feed packages. The bot is already included.

[Build and OpenWrt userspace tests](https://github.com/Medvedolog/luci-app-podkop-bearguard/actions/runs/45201952848) · [Exact source](https://github.com/Medvedolog/luci-app-podkop-bearguard/tree/1cab8ee29646204e666388bfe4d0e0bed62d014b)
