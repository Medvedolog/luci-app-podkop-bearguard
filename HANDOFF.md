# HANDOFF — luci-app-podkop-bot 0.19.19 Tailscale multiprovider

Updated: 2026-09-22

## Repository / branch

- Repository: `Medvedolog/luci-app-podkop-bearguard` (legacy `luci-app-podkop-bot` URL redirects here)
- Development branch: `dev/0.19.19-tailscale-multiprovider`
- Current package version: **`0.19.19-r14`**
- `version.txt` / `Makefile` `PKG_VERSION`: `0.19.19`
- Reviewed baseline before the r14 fix slice: `be66a0d`; r14 aligns Forkop X updater repo selection, branding placement and bounds full-route diagnostics to 90 seconds.
- Do **not** merge to `main`, create a tag, or publish a release without an explicit user command.

This file previously described the `dev/0.19.18-warpscout-luci` / WARPSCOUT-baseline state (`0.19.18-r17`). That description was accurate for its time but was not kept in sync with `dev/0.19.19-tailscale-multiprovider`, which since diverged by ~100 commits of Tailscale/tsnet multiprovider work plus a partial app rebrand. This refresh replaces it with the current state of that branch. The WARPSCOUT/WARP Rescue sections below are condensed from the old file; nothing in that subsystem changed in this refresh, and its hardware-validation TODOs (see `TODO.md`) still stand.

## Current product model

### Navigation

- `Обзор`
- `Настройки → Основные`
- `Настройки → WARP Rescue / WARPSCOUT`
- `Настройки → Мастер настройки`
- `Транспорт → Цепочка прокси`
- `Транспорт → Bearhole`
- `Транспорт → Револьвер WARP`
- `Транспорт → Tailscale` *(new)*
- `Проверка маршрутов → Тест сервисов` *(Runtime split into two tabs; was one page)*
- `Проверка маршрутов → Telegram`
- `Обновление`
- `Логи`
- `Помощь`

Old WARPSCOUT/TG-route/Tailscale URLs have compatibility aliases where already implemented (`admin/services/podkop-bot/transport/warpscout`, `.../warpscout-rescue`, `.../wizard`).

### App branding: "Podkop BearGuard" vs "Podkop Bot" — a deliberate split, not finished

The LuCI package was partially rebranded to **Podkop BearGuard** as the umbrella app name, reflecting that the package is now a control plane for the bot, WARP Rescue/WARPSCOUT, Bearhole and Tailscale/tsnet — not just a bot installer. **Podkop Bot** is intentionally kept as the name of the Telegram bot component specifically (commit `2cb934b`, "ui: keep bot logs identified as Podkop Bot", explicitly reverted an accidental rename of the Logs page heading). So by design:

- Umbrella brand ("Podkop BearGuard"): top menu title, Overview page `h2`, Overview/Logs page footer version string.
- Kept as "Podkop Bot" (bot component, not the app): Logs page `h2` (`_('Логи Podkop Bot')`), Settings page title/form title, Setup Wizard title, the "bot not configured yet" onboarding message.

**This split is real, but the rollout is incomplete.** The page footer that shows `luci-app-podkop-bot v<version> · репозиторий` was only updated to `Podkop BearGuard v...` on `overview.js` and `logs.js`. It was never touched on `help.js`, `settings.js`, `update.js`, `wizard.js` — those four still print the raw `luci-app-podkop-bot` package-name literal in the footer, which is neither of the two chosen brand names. See `TODO.md`.

### Tailscale / tsnet multiprovider architecture

This is the largest change since the last handoff. Three sing-box "providers" are distinguished (`root/usr/lib/podkop_bot/tsnet-provider.sh:tsnet_provider()`):

- **`forkop-native`** — full Forkop with its own native server generator (`/usr/lib/singbox/servers.uc` present). Tailscale is a real Forkop `config server` UCI section with `protocol=tailscale`, the same entity the Telegram bot's own Forkop/Tailscale wizard already manages. LuCI and the bot both mutate that one UCI section directly (`uci -q set forkop.<sec>.*`), then restart Forkop.
- **`forkop-x`** / **`podkop`** (classic Podkop) — neither has a native Tailscale UCI concept. Config lives in a separate state file, `/etc/podkop-bot/tsnet.json` (0600, written by `tsnet_state_write`/`tsnet_state_set_enabled` in `tsnet-provider.sh`), and the Tailscale endpoint is injected directly into the live sing-box JSON config (whichever `tsnet_config_path()` resolves to) as an `{"type":"tailscale","tag":"podkop-bot-tailscale",...}` entry.

Backend: `root/usr/libexec/rpcd/podkop_bot_tailscale` (`api_version: 1`). Methods: `status`, `create`, `set_enabled`, `set_accept_routes`, `set_advertise_exit_node`, `reapply`, `delete`. LuCI view: `root/www/luci-static/resources/view/podkop-bot/tailscale.js` (`Транспорт → Tailscale`). The Telegram bot exposes an equivalent, more limited MVP surface under `Службы` (enable/disable only for non-native providers; full toggles for native).

**Runtime application model — read this before assuming there is a background watcher:**

- Earlier in the 0.19.19 line (`dev/0.19.18-tailscale-multiprovider`, roughly r56–r61) there *was* a continuous background daemon: `podkop-tsnet-overlay` init service running `tsnet-overlay-watch.sh` in a loop, polling the sing-box config file every 3s and re-injecting the Tailscale endpoint whenever Podkop/Forkop X regenerated the config out from under it. It had a real restart-feedback-loop bug (fixed, then the whole approach was retired — commits `85d19bc`/`70fc4e8` fix, then `ec62e7f`/`f2372e6`/`8d2927c`/`2021e77` remove it entirely).
- **As of this branch head, that watcher is gone.** `root/usr/lib/podkop_bot/tsnet-runtime-apply.sh` is a **one-shot** script: it applies (or removes) the Tailscale endpoint in the live sing-box config exactly once, with a CAS/TOCTOU guard (config-file inode:mtime:size signature checked before and after) and a `provider_busy()` check (defers while Forkop X holds `/var/run/forkop.reload.lock`, or classic `podkop` is mid-run). It is invoked synchronously from `podkop_bot_tailscale` on every mutation: `set_enabled`, `set_accept_routes`, `set_advertise_exit_node`, `delete`, and the new explicit **`reapply`** action (added in the UI as a manual recovery button, commits `441caa4`/`cbda6ef`/`c835027`).
- **Consequence: there is no automatic self-healing by default.** If Podkop/Forkop X regenerates its sing-box config for any unrelated reason after Tailscale was enabled, the injected endpoint is silently dropped and stays dropped — `status.runtime_applied` goes `false` (surfaced in the UI as `runtime_state: degraded`) — until the operator clicks **Reapply**, or opts into auto-repair (next point). Anyone who had the old watcher running (0.19.19 dev builds before this removal) loses that self-healing silently on upgrade; `postinst` does stop/disable the leftover `podkop-tsnet-overlay` service (`dfea753`), but nothing tells the operator the recovery model changed.
- **Opt-in cron auto-repair** (`root/usr/lib/podkop_bot/tsnet-auto-repair.sh`, control object `podkop_bot_tsnet_repair`, toggle in `tailscale.js`): a `* * * * *` cron entry (installed unconditionally by `postinst` for every install — cheap no-op when unused, one file stat) runs the helper every minute. It only acts when `auto_repair: true` is set in `tsnet.json` **and** tsnet is enabled **and** the endpoint is actually missing from the live config **and** a readiness probe against Podkop's own transport (`ubus call podkop_bot runtime_sections` + `transport_probe`, i.e. real Mixed Proxy connectivity, not just `pidof sing-box`) succeeds. A `runtime_apply` is then rate-limited to once per `COOLDOWN=300` seconds via a timestamp file.
  - **Known gap (not yet fixed):** the 300s cooldown is only checked *after* the readiness probe(s) run. While auto-repair is on and the endpoint keeps coming up missing, the live `transport_probe` network round-trip (up to two candidate routes) fires on every single cron tick — i.e. every 60 seconds indefinitely — contradicting the script's own "one bounded check per cron invocation" comment. The cooldown only bounds the `runtime_apply` step, not the probing. See `TODO.md`.
- **Standalone `tailscaled` conflict guard**, unchanged in spirit from the earlier preflight work but now checked by both the bot and `podkop_bot_tailscale`: an installed-but-stopped standalone Tailscale is informational only; a *running* one requires an explicit one-time confirmation (`confirm_standalone`) before a second (tsnet) node may be created or enabled, re-checked at the backend immediately before mutation so a daemon started after page load can't bypass it.

### Build/staging contract — read before "fixing" version/port literals in `root/usr/libexec/rpcd/podkop_bot`

`tools/stage.sh` intentionally does **not** treat the raw source of `root/usr/libexec/rpcd/podkop_bot` as the final artifact:

- It `sed`-patches `LUCI_APP_VERSION="..."` to `version.txt`'s value at staging time and then asserts the patched value matches.
- It requires the raw source to contain **exactly two** literal occurrences of `_bh_gateway="http://127.0.0.1:1066"`, and rewrites both to read `podkop_bearhole.main.port` from UCI at staging time (commits `60c53b4`, `15fd395`; comment: "The update backend was written when Bearhole used a fixed 1066 gateway. Keep source compatibility for now...").

So the raw git source of that file will *always* look like it has a stale version string and a hardcoded port — that is expected, not a bug. A built package/IPK (post `tools/stage.sh`) will correctly show the current version and the dynamic port lookup. **This tripped up an automated review in this session**: comparing a built test-kit artifact against raw source produced a false "regression" report; a fix was pushed (`fd5cf48`), it broke `tools/stage.sh`'s own assertion (`expected 2 fixed Bearhole gateways in rpcd, found 0`), CI failed, and it was reverted (`ded2835`). If you are auditing this file for drift, diff against a build produced by `tools/stage.sh`, or diff two raw-source commits against each other — never raw source against a staged artifact.

### WARP Rescue / WARPSCOUT (unchanged since 0.19.18-r17; condensed)

1. WARPSCOUT performs Discovery and ranks WARP candidates.
2. Telegram qualification checks configured routes and WARPSCOUT candidates against real Telegram Bot API `getMe`.
3. Only WARPSCOUT candidates with TG status `VALID` belong in the Revolver magazine.
4. `FIRE` selects a cartridge and verifies Telegram Bot API again before leaving it ON-AIR; `Next WARP` rotates; `Reload` runs Discovery → TG qualification → magazine rebuild → FIRE best VALID candidate.
5. Qualification is diagnostic/advisory and must not mutate authoritative POLL/FAST route state.
6. Persistent user-facing WARP SOCKS is **WARP Rescue only**; the hidden test SOCKS (`/tmp/podkop_bot/warpscout_socks.pid`) is internal to diagnostics and must not appear as a second user-facing WARP service. Persistent Rescue runtime PID file: `/tmp/podkop_bot/warpscout_rescue_socks.pid`.
7. Long WARP/manual route probes run in a detached backend worker (`podkop_bot_probe`) and request server-side cleanup/restore when the worker exits — router-level validation under browser/network loss is still an open TODO item, not yet claimed proven.
8. WARP Rescue is **not** wired as an automatic final POLL/FAST transport failover stage; it remains qualification + Rescue control + Revolver + diagnostics only.

### Bearhole

Emergency system-proxy for OpenWrt's own downloads (curl/opkg/apk), backed by the native `hwelp-proxy` binary. Chooses a working route from the same transport chain (Podkop/Forkop sections, reserve proxies, custom proxy, WARP Rescue, Direct). Port is user-configurable (`podkop_bearhole.main.port`, default 1066) via `Транспорт → Bearhole`; both `podkop_bot_bearhole` and the bot's own use of Bearhole for its own updates read that setting (through the staging-time patch described above). Routing semantics for OpenWrt system traffic generally (beyond the bot's own downloads) are not fully wired — see `TODO.md`.

### Long diagnostics / XHR model (unchanged)

All heavy route/service diagnostics use `start → background worker → short status polling → result` (Podkop/Forkop section checks, configured transport proxies, manual proxies, WARP route checks, batch "Проверить все маршруты", Overview full Outbound test). A lost XHR/browser tab no longer terminates the actual heavy probe. Podkop/Forkop update preflight/download/install is likewise detached. Remaining synchronous calls are intended to stay bounded: one-shot transport probe, token/version checks, `ensure_mixed_proxy`.

### Telegram transport model (unchanged)

The bot keeps POLL and FAST routing state separate. Transport order: `Podkop SOCKS / auto-discovered sections → configured reserve proxies → custom proxy → WARP Rescue → Direct → emergency Telegram IPs` (WARP Rescue was added as a real cascade tier in the 0.19.18 tailscale-multiprovider line; it is a route the bot's own Telegram traffic can fail over onto — this is a different thing from the LuCI/bot Tailscale-server feature described above, which is about Podkop/Forkop serving `tsnet` to *other* devices). The last working route is sticky; degraded paths periodically re-probe higher-priority routes.

## Important files

LuCI views:

- `root/www/luci-static/resources/view/podkop-bot/overview.js` / `overview-async.js` / `overview-state.js` / `overview-live.js`
- `root/www/luci-static/resources/view/podkop-bot/warpscout.js`, `warpscout-rescue.js`
- `root/www/luci-static/resources/view/podkop-bot/runtime-services-only.js`, `runtime-telegram.js` (split Runtime tabs), `runtime.js`, `runtime-async.js`
- `root/www/luci-static/resources/view/podkop-bot/transport.js`, `transport-ux.js`
- `root/www/luci-static/resources/view/podkop-bot/tailscale.js` *(new)*
- `root/www/luci-static/resources/view/podkop-bot/bearhole.js`, `bearhole-live.js`
- `root/www/luci-static/resources/view/podkop-bot/settings.js`, `wizard.js`, `logs.js`, `help.js`, `update.js`, `update-async.js`

Core / workers:

- `root/usr/lib/podkop_bot/podkop_bot` (vendored bot), `root/usr/lib/podkop_bot/vendor.sha256`
- `root/usr/libexec/rpcd/podkop_bot`, `podkop_bot_probe`, `podkop_bot_update_async`
- `root/usr/lib/podkop_bot/tsnet-provider.sh` (shared helpers: `tsnet_provider`, `tsnet_capable`, `tsnet_config_path`, `tsnet_state_*`)
- `root/usr/lib/podkop_bot/tsnet-runtime-apply.sh` (one-shot endpoint apply)
- `root/usr/lib/podkop_bot/tsnet-auto-repair.sh` (opt-in cron self-heal)
- `root/usr/libexec/rpcd/podkop_bot_tailscale`, `podkop_bot_tsnet_repair`

WARPSCOUT rpcd backends: `podkop_bot_warpscout`, `podkop_bot_warpscout_rescue`, `podkop_bot_warpscout_runtime`, `podkop_bot_warpscout_tgscan`.
Bearhole: `root/usr/lib/podkop_bot/bearhole.sh`, `root/usr/libexec/rpcd/podkop_bot_bearhole`, `root/etc/init.d/podkop-bearhole`.

Regression/contract guards worth knowing about before assuming something is untested: `tools/check-sources.sh`, `tools/check-bot-transport.sh`, `tools/check-tailscale-rpc-acl.sh`, `tools/check-tsnet-runtime-integration.sh`, `tools/check-async-wrappers.sh`, `tools/check-ui-layout.sh`, `tools/stage.sh` (build contract, see above).

Project docs:

- `CHANGELOG.md` — historical/release changelog
- `CHANGELOG_DEV.md` — current development changelog (now covers up to 0.19.19)
- `TODO.md` — prioritized remaining work
- `HANDOFF.md` — this file

## Known P0 risks

See `TODO.md` for the full list. Headline items:

- Hardware validation of the tsnet multiprovider paths (forkop-native / forkop-x / podkop) end-to-end: create → enable → reapply after a Podkop/Forkop-triggered config regeneration → auto-repair recovery → delete/purge, on real router hardware. None of this has a "router-verified" claim yet.
- `tsnet-auto-repair.sh` readiness-probe cooldown gap (see architecture section above) — fix before recommending auto-repair to users on flaky links.
- Finish or explicitly scope-freeze the BearGuard footer rollout (`help.js`, `settings.js`, `update.js`, `wizard.js`).
- Everything carried over from the WARPSCOUT/WARP Rescue line that was never marked router-verified: exact Rescue restore after manual hidden-runtime tests, per-endpoint TG status persistence in the shortlist, Overview WARP metadata resolution from the actual Rescue endpoint, Stop/Reload/FIRE hardware verification, POLL/FAST route-state contamination regression check.

## Explicit non-features / do not claim yet

- No continuous process-death WARP Rescue watchdog that automatically rotates after arbitrary later Rescue failure.
- No production POLL/FAST automatic failover through WARP Rescue beyond the cascade tier described above (it is a fallback tier the bot's own transport can use, not a supervised failover state machine).
- Bearhole does not fully own OpenWrt system routing yet — only the bot's own downloads are proven to go through it.
- Manual TG result persistence in Settings is not complete.
- Rich final batch route-test result rendering is not complete.
- tsnet auto-repair is opt-in and has the cooldown gap above; do not describe it as "self-healing" without that caveat.

## Development rules

- Keep machine/syslog messages from `podkop-bot` / `podkop-bot-rpcd` English and machine-readable; do not log localized route display names as authoritative state.
- Keep vendored bot and standalone bot synchronized when bot code is intentionally updated.
- Do not re-use `PKG_RELEASE` for a new router-testable change; bump revision for each new test slice.
- Documentation-only commits do **not** require a package revision bump.
- Do not create release/tag or merge to main without an explicit user command.
- Prefer one clear operator action over multiple confirmation ceremonies; destructive actions should use one meaningful confirmation plus automatic preflight where applicable.
- **Before editing `LUCI_APP_VERSION` or the Bearhole gateway literal in `root/usr/libexec/rpcd/podkop_bot`, read `tools/stage.sh` first** — see "Build/staging contract" above.
- **Keep this file, `TODO.md` and `CHANGELOG_DEV.md` current with the branch they describe.** This refresh was overdue by roughly 100 commits; treat a stale handoff as a bug, not paperwork — it directly caused a false regression report and a wasted fix/revert cycle in this session.
