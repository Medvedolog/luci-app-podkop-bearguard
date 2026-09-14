# Development changelog — 0.19.18

Branch: `dev/0.19.18-warpscout-luci`

This file tracks the current development branch. The large historical `CHANGELOG.md` remains the release history and should absorb this section when 0.19.18 is promoted.

## 0.19.18-r15 — async diagnostics hardening

### Long route/service probes

- Long `active_probe` diagnostics no longer depend on one 15–60 second LuCI XHR. A dedicated `podkop_bot_probe` rpcd worker starts the heavy check in the background and exposes short `start / status / result / cancel` calls.
- The async path is used for Podkop/Forkop section checks, configured transport proxies, manual proxies, WARP checks, batch “all routes” checks and the Overview full Outbound test.
- A lost browser poll/XHR no longer kills the actual probe; LuCI retries status polling and reads the finished result from the router.
- Credentialed manual proxies remain ephemeral: proxy credentials are not persisted in async state/result metadata.
- WARP manual probes now request server-side cleanup. The worker calls the WARPSCOUT runtime stop/restore path when the probe exits, so Rescue restoration is no longer dependent solely on the browser reaching frontend `finally` logic.
- Runtime and Overview menu entries route through compatibility wrapper views (`runtime-async.js`, `overview-async.js`) so the existing rendering/state logic remains shared instead of being forked.

### XHR audit

- The principal problematic synchronous path was `active_probe`; all user-facing callers are now routed through the detached worker.
- Existing installer/LuCI/WARPSCOUT long operations already use background workers plus log/status polling.
- `podkop_update_run` still performs network/disk preflight and install-script fetch synchronously before its updater worker starts; this can become long when direct GitHub access fails and the proxy chain is tried. It is now tracked separately for hardening.
- `test_telegram`, `ensure_mixed_proxy`, update checks and one-shot transport probes remain bounded synchronous calls (generally single-digit to low-teens seconds), not the 60+ second class addressed here.

## 0.19.18-r14 — previous test build

### WARP Rescue / WARPSCOUT

- Added WARPSCOUT integration to LuCI with installation/removal, WARP account registration/import, Discovery, shortlist, targeted recheck, runtime diagnostics and Rescue controls.
- Added a dedicated **WARP Revolver** view. Its magazine contains only WARP candidates qualified as `VALID` by Telegram Bot API.
- `FIRE` activates a selected cartridge and verifies Telegram Bot API before leaving it `ON-AIR`.
- `Reload` runs the intended pipeline: Discovery → Telegram API qualification → magazine rebuild → fire best VALID candidate.
- `Stop WARP` now stops Rescue and empties the magazine while preserving WARPSCOUT discovery data and qualification inputs.
- Rescue is the only user-facing persistent WARP SOCKS. The hidden test SOCKS is internal to diagnostics.
- Telegram qualification uses a separate transient WARP scan port so an active Rescue tunnel can remain on-air while candidates are checked.
- WARPSCOUT status calls are local/cache-only during normal page refresh; network version checks are forced only when explicitly requested.
- Rescue status no longer rebuilds the magazine on each poll and now exposes process PID/RSS.
- Added operation progress for Reload/FIRE and clearer revolver states.
- WARPSCOUT settings were moved to `Настройки → WARP Rescue / WARPSCOUT`; transport keeps `Цепочка прокси` and `Револьвер WARP`.
- Added compatibility aliases for old LuCI URLs.
- Removed duplicate “Open revolver” button from WARPSCOUT settings.
- Added Russian tooltips for the main WARPSCOUT settings and actions.

### Telegram API qualification

- Unified qualification covers tier1, auto-discovered Podkop/Forkop sections, configured fallback proxies, tier3 and WARPSCOUT candidates.
- Legacy manual `#WARP-SCOUT` fallback entries are excluded from qualification/runtime selectors.
- Fixed parser handling for Telegram scan result/plan JSON on router `jq` variants.
- Runtime no longer leaves a permanent red `parse_error` card; last known-good results are preserved.
- `already_running` now attaches LuCI to the existing qualification instead of showing duplicate red errors.
- POLL / FAST / ON-AIR route tags are shown separately where available.

### Runtime / route checks

- Runtime was renamed in the menu to **Проверка маршрутов**.
- Telegram API qualification is embedded in the route-check page; the separate TG routes tab is hidden and old URL aliases to the new location.
- WARP runtime checks use the actual Rescue endpoint instead of silently testing a different WARP exit.
- Added progress text with elapsed time for route, proxy and WARP checks.
- “Проверить все маршруты” now warns that a large set can take up to about 90 seconds and load the router.
- Full route test continues to check geo, service reachability and throughput/TSPU symptoms.

### Transport UI

- `Пул прокси` renamed to **Цепочка прокси**.
- UI wording was normalized to Russian where the English term is not a protocol/API name.
- Machine badges such as `VALID`, `FAIL`, `POLL`, `FAST`, `ON-AIR` remain unchanged.

### Overview / UI language

- Overview WARP block now describes Rescue rather than the hidden test runtime.
- Removed meaningless endpoint-ping row from the overview card.
- Normalized mixed Russian/English wording across WARPSCOUT, Revolver, Route checks, Proxy chain, Overview, Help and Update pages.
- Kept protocol/product names such as WARP, SOCKS, HTTP, Telegram Bot API, AWG and MASQUE unchanged.

### Packaging / CI

- Package revision advanced through development slices to **0.19.18-r15**.
- r14 commit: `abf6ab5a8b085806bf87a5aef709da4cb52e677f`.
- r14 GitHub Actions CI run **#173** completed successfully.
- Native OpenWrt package artifact contains both IPK and APK builds.

## Known limitations / not yet claimed complete

- Continuous automatic WARP Rescue process-death watchdog/rotation is not implemented yet.
- WARP is not yet wired as an automatic final POLL/FAST failover stage; current integration is qualification + Rescue + manual/runtime control.
- Async WARP restore logic is implemented in r15 but still needs router-level validation against browser/XHR loss and process failure.
- WARPSCOUT shortlist manual TG result persistence across page refresh still needs completion.
- Overview metadata can still be incomplete when the active Rescue endpoint is not matched to a current WARPSCOUT snapshot.
- Batch route-test summary is still intentionally compact and needs a richer final result view.
- Bearhole/OpenWrt Rescue backend hook exists, but routing semantics are not active yet.
