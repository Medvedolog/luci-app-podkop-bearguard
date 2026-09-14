# Development changelog — 0.19.18

Branch: `dev/0.19.18-warpscout-luci`

This file tracks the current development branch. The large historical `CHANGELOG.md` remains the release history and should absorb this section when 0.19.18 is promoted.

## 0.19.18-r14 — current test build

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

- Package revision advanced through development slices to **0.19.18-r14**.
- r14 commit: `abf6ab5a8b085806bf87a5aef709da4cb52e677f`.
- GitHub Actions CI run **#173** completed successfully.
- Native OpenWrt package artifact contains both IPK and APK builds.

## Known limitations / not yet claimed complete

- Continuous automatic WARP Rescue process-death watchdog/rotation is not implemented yet.
- WARP is not yet wired as an automatic final POLL/FAST failover stage; current integration is qualification + Rescue + manual/runtime control.
- Exact restoration of the previously active Rescue endpoint after every hidden manual test still needs router-level verification/hardening.
- WARPSCOUT shortlist manual TG result persistence across page refresh still needs completion.
- Overview metadata can still be incomplete when the active Rescue endpoint is not matched to a current WARPSCOUT snapshot.
- Batch route-test summary is still intentionally compact and needs a richer final result view.
- Bearhole/OpenWrt Rescue backend hook exists, but routing semantics are not active yet.
