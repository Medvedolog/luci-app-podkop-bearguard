# Development changelog — 0.19.19

Branch: `dev/0.19.19-tailscale-multiprovider`

This file tracks the current development branch. The large historical `CHANGELOG.md` remains the release history and should absorb this section when 0.19.19 is promoted. This file was not updated between 0.19.18-r55 and 0.19.19-r1 (~100 commits); that gap is closed below in one pass rather than commit-by-commit, since the intermediate r56–r61 revisions were themselves short-lived CI test slices, not independently shipped states.

## 0.19.19-r15 — Bearhole explicit multi-address listeners

- Bearhole always binds `127.0.0.1` and may additionally bind explicitly configured local IPv4/IPv6 addresses, separated by semicolons in LuCI.
- Additional listeners are separate procd instances sharing the same route table, port, authentication and log; OpenWrt's own system proxy continues to use loopback.
- Only addresses actually assigned to router interfaces are accepted. `0.0.0.0` and `::` wildcard listeners are rejected; duplicates are normalized away.
- Existing configurations without `listen_ips` remain loopback-only.
- Package revision bumped to r15.

## 0.19.19-r14 — Forkop X updater, branding placement, bounded full-route probe

- LuCI update backend resolves generic `forkop` to the actual flavour before selecting the repository/cache key: Forkop X → `slayer326/forkop`, full Forkop → `ushan0v/forkop`.
- `tsnet-provider.sh` uses `/usr/share/forkop/mirror-migration.sh` as positive Forkop X evidence, matching the standalone bot.
- Services package/menu label is `Podkop BearGuard`; Overview status heading is `Podkop Bot`.
- Full route diagnostics no longer have a ~200s worst-case: geo/speed stages are bounded more tightly and the detached worker enforces a 90s ceiling.
- Package revision bumped to r14.

## 0.19.19-r13 — review fixes: Forkop identity, multiline updates, mobile service details

- Fixed `_forkop_display_name()` UCI end-anchor and added `/usr/share/forkop/mirror-migration.sh` as positive Forkop X evidence, keeping update sources aligned with the actual fork.
- Preserved multiline Telegram input without losing `user_id`/document metadata by base64-wrapping the text field inside the consolidated jq record before shell parsing.
- Service-matrix details remain compact but are now available by tap/click (and keyboard), not hover-only.
- Bumped `PKG_RELEASE` from 12 to 13 because this is a new router-testable code slice; vendored bot stays byte-identical to standalone.

## 0.19.19-r1 — Tailscale/tsnet goes multiprovider; overlay watcher retired; opt-in auto-repair; partial rebrand

### Tailscale / tsnet architecture

- Split Tailscale support by sing-box "provider": `forkop-native` (unchanged — real Forkop `config server`/`protocol=tailscale` UCI section, same entity the Telegram bot's wizard already manages), `forkop-x` and classic `podkop` (new — no native UCI concept; config lives in `/etc/podkop-bot/tsnet.json`, endpoint is injected directly into the live sing-box JSON config).
- New rpcd backend `podkop_bot_tailscale` (`api_version: 1`): `status`, `create`, `set_enabled`, `set_accept_routes`, `set_advertise_exit_node`, `reapply`, `delete`. New LuCI view `tailscale.js` under `Транспорт → Tailscale`.
- Capability probing (`tsnet_capable()`/`singbox_supports_tailscale()`) never executes `sing-box` — package-manager/variant-file checks first, then a cached `grep -aF with_tailscale` stream-scan of the binary, keyed by an inode:mtime:size signature. Avoids spawning a second Go process on low-RAM routers.
- Standalone `tailscaled` conflict detection (installed-vs-running) is checked by both LuCI and the bot, with the backend repeating the running-daemon check immediately before any mutation — a daemon started after page load still can't bypass confirmation.
- **Background overlay watcher added, then fully retired within this line.** It briefly existed as `podkop-tsnet-overlay` (procd service) + `tsnet-overlay-watch.sh` (continuous 3s-poll loop that re-injected the endpoint whenever Podkop/Forkop regenerated its sing-box config). It had a real restart-feedback-loop bug that was fixed first, then the whole approach was replaced: `tsnet-runtime-apply.sh` is now a **one-shot** apply (CAS/TOCTOU-guarded by a config-file signature, deferred while the provider holds its reload lock), invoked synchronously on every `podkop_bot_tailscale` mutation. `postinst` stops/disables any leftover watcher service from earlier 0.19.19 dev builds.
- Added an explicit **Reapply** action/button (`method_reapply`) as the manual recovery path now that there is no background watcher to silently retry.
- Added **opt-in cron auto-repair**: `tsnet-auto-repair.sh` + control object `podkop_bot_tsnet_repair`, a `* * * * *` cron entry installed unconditionally (near-zero cost when unused/disabled). When enabled, it only acts if the endpoint is actually missing from the live config *and* a Mixed-Proxy transport-readiness probe (`podkop_bot runtime_sections` + `transport_probe`, not just `pidof sing-box`) succeeds; the actual repair is rate-limited to once per 300s. **Known gap, not yet fixed:** the 300s cooldown only bounds the repair step, not the readiness probe itself, so a persistently-missing endpoint causes live network probes every cron tick (60s) — see `TODO.md`.
- Visual Tailscale health indicators added to the status card, then the card was simplified again (`1430140`) once the indicators proved noisy.
- Fixed missing `set_accept_routes` in the LuCI RPC ACL (`feb57ec`) — the button existed and worked in the backend but every call was rejected under the standard ACL-scoped LuCI session.
- Classic `podkop` variant gained a Tailscale/Services menu entry it didn't have before (multiprovider MVP simplification, `4bbead7`).
- Forkop X migration: a native Forkop `config server`/`protocol=tailscale` section left over from switching to Forkop X is now detected as "legacy" and can be deleted as inert UCI only (never restarts Forkop/sing-box for a section it can't service) — fixed after an initial version routed the cleanup callback incorrectly (`f010de6`, `cceb1e3`).

### Branding

- Partially rebranded the LuCI app as **"Podkop BearGuard"** (menu title, Overview `h2`, Overview/Logs footer). Deliberately kept **"Podkop Bot"** as the name of the Telegram bot component specifically (Logs `h2`, Settings, Setup Wizard, onboarding message) — commit `2cb934b` explicitly reverted an over-eager rename of the Logs heading.
- **Not finished:** the footer rollout only reached `overview.js`/`logs.js`; `help.js`, `settings.js`, `update.js`, `wizard.js` still show the raw `luci-app-podkop-bot` package-name literal. See `TODO.md`.
- README, owfeed package description and CI metadata updated for 0.19.19/multiprovider features; `HANDOFF.md`/`TODO.md`/this file were not — that gap is what this refresh closes.

### Packaging

- Version bumped to `0.19.19` (`7b49515`), standalone bot synchronized (`993dbcb`/`09132f7`), package revision `0.19.19-r1`.
- Runtime menu tab split into `Тест сервисов` (`runtime-services-only.js`) and `Telegram` (`runtime-telegram.js`) — was one `Проверка маршрутов` page.
- `tools/check-tailscale-rpc-acl.sh` and `tools/check-tsnet-runtime-integration.sh` added as CI guards for the RPC/ACL contract and the watcher-free runtime model, so both classes of bug above (missing ACL entry, resurrecting the watcher) now fail CI instead of shipping silently.

## 0.19.18-r55 — Tailscale / tsnet standalone conflict preflight

### Tailscale / Forkop

- Added LuCI management for the same Forkop `config server` / `protocol=tailscale` UCI entity already used by the Telegram bot, so both interfaces operate on one endpoint instead of maintaining parallel state.
- Before creating or enabling sing-box `tsnet`, LuCI and the Telegram bot now detect a classic standalone Tailscale installation and whether `tailscaled` is currently running.
- An installed but stopped standalone Tailscale is reported as information only. A running standalone daemon triggers an explicit warning and requires a one-time confirmation before the second Tailscale node may be created or enabled.
- The backend repeats the running-daemon check at mutation time; the LuCI browser warning is not the only safety gate, so a daemon started after page load still cannot silently bypass confirmation.
- Creation remains config-only and disabled. Enabling the endpoint is a separate action and performs the conflict check again immediately before the Forkop/sing-box restart.
- No standalone Tailscale service is stopped, disabled, reconfigured or removed automatically.

### Telegram bot synchronization

- Standalone source branch: `Medvedolog/podkop_bot`, `dev/0.19.18-tailscale-preflight`, commit `90771c26e1c56c37f6c4a54a8b461baa0eedd715`.
- The vendored bot is synchronized byte-for-byte with standalone and keeps the existing Forkop/Tailscale wizard, UCI contract and one-managed-endpoint behavior.
- Standalone patch validation includes `sh -n` before commit; the LuCI synchronization validates the downloaded bot again before replacing the vendored copy.

### Packaging

- Package revision bumped to **0.19.18-r55** because both the LuCI Tailscale control path and the vendored bot changed.

## 0.19.18-r17 — bot pending-state navigation regression fix

### Telegram bot

- Fixed a state-machine regression where a persistent reply-keyboard command such as `📊 Статус` could be consumed as pending text input while the bot was waiting for a value such as `wait_admin_id`.
- `cmd_status` now wins over pending text input: the stale pending state is cleared and the normal Status handler is executed instead of validating the button label as a Telegram ID.
- The standalone fix landed first in `Medvedolog/podkop_bot`, branch `dev/0.19.17-security-hardening`, commit `f623692915ea6c134155df727551225228282625`.
- The same bot body was then synchronized into the LuCI vendored copy. `vendor.sha256` now pins `0926d9797dcb951e286080c2ede09548cf2781b860e1df8a570e578f41182a8b`.

### Packaging / CI

- Package revision bumped to **0.19.18-r17** because the vendored executable changed and needs a distinct router-testable artifact.
- GitHub Actions run `#196` (`34822264197`) passed source checks, native OpenWrt package build and install tests for both OpenWrt 25.12 APKv3 and OpenWrt 24.10 IPK.
- Artifact: `owfeed-packages`, id `10338378001`, digest `sha256:910eed092bf8f0c0af16728c5571eedca2e11df17154df0b6d083bee9826ec55`.

## 0.19.18-r16 — detached long-operation hardening

### Long route/service probes

- Long `active_probe` diagnostics no longer depend on one 15–60 second LuCI XHR. A dedicated `podkop_bot_probe` rpcd worker starts the heavy check in the background and exposes short `start / status / result / cancel` calls.
- The async path is used for Podkop/Forkop section checks, configured transport proxies, manual proxies, WARP checks, batch “all routes” checks and the Overview full Outbound test.
- A lost browser poll/XHR no longer kills the actual probe; LuCI retries status polling and reads the finished result from the router.
- Credentialed manual proxies remain ephemeral: proxy credentials are not persisted in async state/result metadata.
- WARP manual probes request server-side cleanup. The worker calls the WARPSCOUT runtime stop/restore path when the probe exits, so Rescue restoration is no longer dependent solely on the browser reaching frontend `finally` logic.
- Runtime and Overview menu entries route through compatibility wrapper views (`runtime-async.js`, `overview-async.js`) so the existing rendering/state logic remains shared instead of being forked.

### Update path / XHR audit

- The LuCI Podkop/Forkop updater was also moved off the long synchronous XHR path: network preflight, installer download and install startup are launched by a detached backend helper, while the browser performs short log/status polls.
- The principal problematic synchronous path was `active_probe`; all user-facing callers now use the detached worker.
- Remaining synchronous calls such as one-shot transport probes, token/version checks and `ensure_mixed_proxy` are bounded operations and are not in the 60+ second diagnostic class.

## 0.19.18-r14 — WARPSCOUT / WARP Rescue UI baseline

### WARP Rescue / WARPSCOUT

- Added WARPSCOUT integration to LuCI with installation/removal, WARP account registration/import, Discovery, shortlist, targeted recheck, runtime diagnostics and Rescue controls.
- Added a dedicated **WARP Revolver** view. Its magazine contains only WARP candidates qualified as `VALID` by Telegram Bot API.
- `FIRE` activates a selected cartridge and verifies Telegram Bot API before leaving it `ON-AIR`.
- `Reload` runs the intended pipeline: Discovery → Telegram API qualification → magazine rebuild → fire best VALID candidate.
- `Stop WARP` stops Rescue and empties the magazine while preserving WARPSCOUT discovery data and qualification inputs.
- Rescue is the only user-facing persistent WARP SOCKS. The hidden test SOCKS is internal to diagnostics.
- Telegram qualification uses a separate transient WARP scan port so an active Rescue tunnel can remain on-air while candidates are checked.
- WARPSCOUT status calls are local/cache-only during normal page refresh; network version checks are forced only when explicitly requested.
- Rescue status no longer rebuilds the magazine on each poll and exposes process PID/RSS.
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
- `already_running` attaches LuCI to the existing qualification instead of showing duplicate red errors.
- POLL / FAST / ON-AIR route tags are shown separately where available.

### Runtime / route checks

- Runtime was renamed in the menu to **Проверка маршрутов**.
- Telegram API qualification is embedded in the route-check page; the separate TG routes tab is hidden and old URL aliases to the new location.
- WARP runtime checks use the actual Rescue endpoint instead of silently testing a different WARP exit.
- Added progress text with elapsed time for route, proxy and WARP checks.
- “Проверить все маршруты” warns that a large set can take up to about 90 seconds and load the router.
- Full route test continues to check geo, service reachability and throughput/TSPU symptoms.

### Transport UI

- `Пул прокси` renamed to **Цепочка прокси**.
- UI wording was normalized to Russian where the English term is not a protocol/API name.
- Machine badges such as `VALID`, `FAIL`, `POLL`, `FAST`, `ON-AIR` remain unchanged.

### Overview / UI language

- Overview WARP block describes Rescue rather than the hidden test runtime.
- Removed meaningless endpoint-ping row from the overview card.
- Normalized mixed Russian/English wording across WARPSCOUT, Revolver, Route checks, Proxy chain, Overview, Help and Update pages.
- Kept protocol/product names such as WARP, SOCKS, HTTP, Telegram Bot API, AWG and MASQUE unchanged.

## Known limitations / not yet claimed complete

- Continuous automatic WARP Rescue process-death watchdog/rotation is not implemented yet.
- WARP is not yet wired as an automatic final POLL/FAST failover stage; current integration is qualification + Rescue + manual/runtime control.
- Detached WARP restore logic is implemented but still needs router-level validation against browser/network loss and process failure.
- WARPSCOUT shortlist manual TG result persistence across page refresh still needs completion.
- Overview metadata can still be incomplete when the active Rescue endpoint is not matched to a current WARPSCOUT snapshot.
- Batch route-test summary is still intentionally compact and needs a richer final result view.
- Bearhole/OpenWrt Rescue backend hook exists, but routing semantics are not active yet.
