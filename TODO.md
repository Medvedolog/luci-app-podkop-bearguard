# TODO — dev/0.19.19-tailscale-multiprovider

Priorities are ordered by release risk, not by implementation size. This list was rewritten on 2026-09-19; the previous version described the 0.19.18-r17 WARPSCOUT baseline and had not been updated for ~100 commits of Tailscale/tsnet multiprovider work. Items below carried over from that list are marked accordingly.

## P0 — before calling 0.19.19 ready

- [ ] **Hardware-validate the tsnet multiprovider lifecycle end-to-end**, on each of the three providers where reachable (forkop-native, forkop-x, classic podkop): create (disabled) → enable → confirm `runtime_applied: true` and a real tailnet registration → force a config regeneration from Podkop/Forkop's own side and confirm the endpoint drops out of the live config → **Reapply** button actually restores it → delete/purge cleans up identity state. None of this has a router-verified claim yet; it has only been read/reasoned about from source.
- [ ] **Fix `tsnet-auto-repair.sh`'s cooldown placement.** `COOLDOWN=300` currently only bounds the `runtime_apply` call, not the `transport_probe` readiness check(s) that precede it. While auto-repair is enabled and the endpoint stays missing, live network probes fire every 60s (every cron tick) indefinitely. Move the cooldown check before the readiness probe, or record a "probe attempted" timestamp independent of the "repair applied" timestamp.
- [ ] **Decide the standalone-`tailscaled`-running conflict UX once, and audit that both LuCI and the Telegram bot implement it identically** (confirm-once, backend re-checks at mutation time, no automatic changes to the standalone service). This has already had one confirm-flow bug (LuCI: `ts_x_*`/`ts_r_*` route toggles incorrectly routed through the "second identity" confirm gate) fixed earlier in this line — re-verify it stayed fixed after the multiprovider MVP simplification pass (`4bbead7`, `1430140`).
- [ ] **Finish or explicitly scope-freeze the "Podkop BearGuard" rebrand.** The footer version string (`luci-app-podkop-bot v...`) was only updated to the new brand on `overview.js` and `logs.js`; `help.js`, `settings.js`, `update.js`, `wizard.js` still show the raw package-name literal — neither "Podkop BearGuard" nor the intentionally-kept "Podkop Bot". Either roll the same footer change out to the remaining four views, or write down explicitly (in `HANDOFF.md`) that the rebrand is menu/Overview-scoped only and the footer is out of scope.
- [ ] **Router-verify Reapply and auto-repair don't race a live Podkop/Forkop reload.** `provider_busy()` (checked in both `tsnet-runtime-apply.sh` and `tsnet-auto-repair.sh`) covers `forkop.reload.lock` and a running `/usr/bin/podkop` process; confirm on hardware this is not a narrow race window during Forkop X reloads that don't hold the lock for the whole config-write duration.
- [ ] **Confirm `postinst` cleanly retires the old `podkop-tsnet-overlay` watcher on upgrade** from a build that had it running (any 0.19.19 dev build before `2021e77`), including on routers where the service was mid-restart-loop from the feedback-loop bug that predated its removal.

### Carried over from the WARPSCOUT/WARP Rescue baseline (still not marked router-verified)

- [ ] **Harden exact Rescue restore after manual hidden-runtime tests.** Capture the exact previous Rescue endpoint/state before any temporary test SOCKS starts; restore it on completion or error. Do not claim exact restoration until tested on hardware.
- [ ] **Persist per-endpoint TG status in WARPSCOUT shortlist** across `refreshView()`/page reload.
- [ ] **Fix Overview WARP metadata resolution** when `active_snapshot` is empty/stale — resolve by the actual Rescue endpoint from the shortlist instead of showing dash-filled rows.
- [ ] **Router-verify Stop WARP semantics**: Rescue stops, magazine becomes `0 / 0`, shortlist/discovery data remain intact, a later Reload rebuilds normally.
- [ ] **Router-verify Reload/FIRE with Rescue already active**: qualification must use the transient scan SOCKS/port and must not kill/replace the persistent Rescue until FIRE succeeds.
- [ ] **Regression-check POLL and FAST separation**: TG qualification, Runtime and watchdog diagnostics must never overwrite authoritative POLL/FAST route state. Now also covers the WARP Rescue transport-cascade tier added in this line — confirm it participates in sticky/demotion logic correctly and doesn't get treated as diagnostic-only.

## P1 — important UX / diagnostics

- [ ] **Make the all-routes final summary rich** (outbound/server, country/provider/IP, Telegram result, service pass/fail, speed/TSPU, errors; collapsible details).
- [ ] **Clarify Shortlist vs Magazine visually** (WARPSCOUT).
- [ ] **Remove/migrate legacy manual `WARP-SCOUT` fallback config entries** instead of only filtering them.
- [ ] **Finish Russian UI language audit** in remaining edge strings/errors/rare dialogs; keep protocol/API/product names and machine badges (`VALID`, `FAIL`, `POLL`, `FAST`, `ON-AIR`) unchanged.
- [ ] **Audit tooltips** on WARPSCOUT and Tailscale settings for overflow/accessibility on desktop/mobile LuCI themes.
- [ ] **Add explicit timestamps/age to Tailscale runtime status fields**, matching the pattern already used for WARPSCOUT qualification age, so a stale `runtime_state` isn't mistaken for current.
- [ ] **Surface the auto-repair cooldown/interval in the UI** (`podkop_bot_tsnet_repair.status` already reports `interval_seconds`/`cooldown_seconds`/`readiness` — `tailscale.js` doesn't show them yet), so an operator who enables it understands the recovery cadence.

## P2 — architecture / follow-up features

- [ ] **Continuous WARP Rescue watchdog** (process-death rotation without an open LuCI page).
- [ ] **Integrate WARP Rescue into real Telegram transport failover** beyond the cascade tier: define interaction with sticky POLL/FAST and recovery back to higher-priority routes explicitly (partially done — WARP Rescue is now a real `_try_all_tiers` tier — but the design intent vs. current behavior should be written down in `HANDOFF.md` once settled).
- [ ] **Define Bearhole/OpenWrt Rescue semantics beyond the bot's own downloads** before claiming it protects general system routing.
- [ ] **Unify qualification/result storage** across Settings, Revolver, Runtime and Overview.
- [ ] **Add deterministic state-machine tests** for Discovery → qualification → magazine → FIRE → Stop/Reload, and for tsnet create → enable → drop → reapply/auto-repair → delete.
- [ ] **Add a source check for the brand split** (`Podkop BearGuard` vs `Podkop Bot`) analogous to the existing Russian-terminology guard, once the rollout above is finished, so the two names can't drift apart again silently.

## P3 — polish / release preparation

- [ ] Merge development notes from `CHANGELOG_DEV.md` into `CHANGELOG.md` when 0.19.19 is finalized.
- [ ] Update README screenshots/navigation now that Runtime is two tabs and Transport has a Tailscale entry.
- [ ] Finalize release notes only after hardware validation; do not create tag/release from this branch without an explicit command.
- [ ] Confirm IPK/APK artifacts install and upgrade cleanly from the previous public release, including the `podkop-tsnet-overlay` retirement path (see P0 above).
