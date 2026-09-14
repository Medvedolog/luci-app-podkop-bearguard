# HANDOFF — luci-app-podkop-bot 0.19.18 WARPSCOUT integration

Updated: 2026-09-14

## Repository / branch

- Repository: `Medvedolog/luci-app-podkop-bot`
- Development branch: `dev/0.19.18-warpscout-luci`
- Current package version: `0.19.18-r14`
- Current r14 commit: `abf6ab5a8b085806bf87a5aef709da4cb52e677f`
- CI: GitHub Actions run `#173`, success
- Do **not** merge to `main`, create a tag, or publish a release without an explicit user command.

## Current product model

### Navigation

- `Настройки → Основные`
- `Настройки → WARP Rescue / WARPSCOUT`
- `Транспорт → Цепочка прокси`
- `Транспорт → Револьвер WARP`
- `Проверка маршрутов`

Old WARPSCOUT/TG-route URLs have compatibility aliases where already implemented.

### WARP architecture

1. WARPSCOUT performs Discovery and ranks WARP candidates.
2. Telegram qualification checks configured routes and WARPSCOUT candidates against real Telegram Bot API `getMe`.
3. Only WARPSCOUT candidates with TG status `VALID` belong in the Revolver magazine.
4. `FIRE` selects a cartridge and verifies Telegram Bot API again before leaving it ON-AIR.
5. `Next WARP` rotates to the next cartridge.
6. `Reload` is intended to run: Discovery → TG qualification → magazine rebuild → FIRE best VALID candidate.
7. Qualification is diagnostic/advisory and must not mutate authoritative POLL/FAST route state.
8. Persistent user-facing WARP SOCKS is **WARP Rescue only**.
9. Hidden test SOCKS is internal to diagnostics and must not appear as a second user-facing WARP service.

### Important runtime separation

Persistent Rescue runtime:

- PID file: `/tmp/podkop_bot/warpscout_rescue_socks.pid`

Hidden manual/test runtime:

- PID file: `/tmp/podkop_bot/warpscout_socks.pid`

Manual WARP checks must not silently test a different exit from the one shown to the operator. If Rescue needs to be paused for a hidden-runtime operation, the exact previous endpoint/state should be restored on success or error. This exact-restore guarantee still needs backend hardening/router verification; do not overclaim it in UI/docs.

## Telegram transport model

The bot keeps POLL and FAST routing state separate.

Normal transport order remains conceptually:

`Podkop SOCKS / auto-discovered sections → configured reserve proxies → custom proxy → Direct → emergency Telegram IPs`

The last working route is sticky and is tried first. Degraded Direct/Emergency paths periodically re-probe higher-priority SOCKS routes and recover upward when available.

WARP Rescue is **not yet** wired as an automatic final POLL/FAST failover stage. Current WARP work is qualification, Rescue control, Revolver and diagnostics.

## Completed in the current development line

### WARPSCOUT backend/UI

- Install/remove WARPSCOUT from LuCI.
- WARP account create/import.
- Discovery / shortlist / targeted recheck.
- Rescue start/stop.
- Revolver magazine, FIRE, Next and Reload controls.
- Stop WARP empties the magazine while preserving discovery inputs.
- Rescue status is lightweight/local and no longer rebuilds the magazine on every poll.
- Status exposes PID/RSS where available.
- Normal WARPSCOUT status refresh does not hit GitHub; network version check is explicit/forced.

### Telegram qualification

- Dedicated tgscan backend.
- Separate transient WARP qualification port so active Rescue can stay on-air during candidate qualification.
- Includes tier1, auto-discovered Podkop/Forkop sections, configured fallback proxies, tier3 and WARP candidates.
- Legacy `#WARP-SCOUT` manual fallback entries are filtered from scan/runtime selectors.
- Result/plan parser hardened for router jq behavior.
- Runtime preserves last good TG result instead of leaving a permanent parser error card.
- `already_running` attaches to the existing scan instead of showing duplicate red errors.

### LuCI UX

- WARPSCOUT moved under Settings.
- Separate TG Routes page removed from visible navigation; TG qualification is integrated into route checks.
- `Runtime` renamed to `Проверка маршрутов`.
- `Пул прокси` renamed to `Цепочка прокси`.
- Russian wording pass completed across major WARPSCOUT/Revolver/Runtime/Transport/Overview/Help/Update surfaces.
- Protocol/API/product names remain English where appropriate: WARP, SOCKS, HTTP, Telegram Bot API, AWG, MASQUE.
- Machine-status badges remain `VALID`, `FAIL`, `POLL`, `FAST`, `ON-AIR`.
- WARPSCOUT settings now have explanatory tooltips for main fields/actions.
- All-routes check warns that many routes may take up to about 90 seconds and load the router.

## Important files

LuCI views:

- `root/www/luci-static/resources/view/podkop-bot/warpscout.js`
- `root/www/luci-static/resources/view/podkop-bot/warpscout-rescue.js`
- `root/www/luci-static/resources/view/podkop-bot/runtime.js`
- `root/www/luci-static/resources/view/podkop-bot/transport.js`
- `root/www/luci-static/resources/view/podkop-bot/overview.js`
- `root/www/luci-static/resources/view/podkop-bot/help.js`
- `root/www/luci-static/resources/view/podkop-bot/update.js`

WARPSCOUT rpcd backends:

- `root/usr/libexec/rpcd/podkop_bot_warpscout`
- `root/usr/libexec/rpcd/podkop_bot_warpscout_rescue`
- `root/usr/libexec/rpcd/podkop_bot_warpscout_runtime`
- `root/usr/libexec/rpcd/podkop_bot_warpscout_tgscan`

Project docs:

- `CHANGELOG.md` — historical release changelog
- `CHANGELOG_DEV.md` — current 0.19.18 development changelog
- `TODO.md` — prioritized remaining work
- `HANDOFF.md` — this file

## Recent commits of interest

- `e5248156` — harden Telegram qualification result/plan parsing
- `06b2c050` — Stop WARP empties magazine
- `dca94cb2` — Runtime TG lifecycle / preserve valid results / already-running handling
- `a3b631e2` — remove duplicate revolver button
- `15630495` — r11
- `b7370c91` — menu rename pass
- `532a905a` — r12
- `5907831a` — WARPSCOUT Russian wording
- `a7effe43` — Runtime wording + all-routes warning
- `9d497b7b` — Revolver wording
- `216dd639` — r13
- `749e3eec` — WARPSCOUT tooltips
- `cf65f5ee` — Proxy chain wording cleanup
- `1d9762be` — Overview wording cleanup
- `88fc8ab3` — Help wording/navigation cleanup
- `d9ef4913` — Update-page wording cleanup
- `abf6ab5a` — r14

## Latest known build

GitHub Actions:

- Run: `34790095744`
- Run number: `#173`
- Result: success
- Artifact: `owfeed-packages`
- Artifact id: `10327676412`
- Artifact digest: `sha256:62a3fb52f631075781b7e63d8fa066623e4c9603e06a6dd313ae78977d7e0bda`

Expected package names inside the artifact:

- `luci-app-podkop-bot_0.19.18-r14_all.ipk`
- `luci-app-podkop-bot-0.19.18-r14.apk`

## Known P0 risks

See `TODO.md` for the full list. The release-blocking items are currently:

- router validation of TG qualification parser/lifecycle fixes;
- exact Rescue endpoint restoration around hidden/manual tests;
- persistent per-endpoint TG status in WARPSCOUT shortlist;
- resolving Overview metadata from the actual Rescue endpoint;
- Stop/Reload/FIRE hardware verification;
- regression verification that qualification/runtime never contaminates POLL/FAST route state.

## Explicit non-features / do not claim yet

- No continuous process-death WARP watchdog that automatically rotates after arbitrary later Rescue failure.
- No production POLL/FAST automatic failover through WARP Rescue yet.
- Bearhole/OpenWrt Rescue hook does not currently change routing.
- Manual TG result persistence in Settings is not complete yet.
- Rich final batch result rendering is not complete yet.

## Development rules

- Keep machine/syslog messages from `podkop-bot` / `podkop-bot-rpcd` English and machine-readable; do not log localized route display names as authoritative state.
- Keep vendored bot and standalone bot synchronized when bot code is intentionally updated.
- Do not re-use `PKG_RELEASE` for a new router-testable change; bump revision for each new test slice.
- Do not create release/tag or merge to main without an explicit user command.
- Prefer one clear operator action over multiple confirmation ceremonies; destructive actions should use one meaningful confirmation plus automatic preflight where applicable.
