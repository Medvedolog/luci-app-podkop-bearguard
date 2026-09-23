# TODO — dev/0.19.19-tailscale-multiprovider

Priorities are ordered by release risk, not by implementation size. Refreshed 2026-09-23 against `0.19.19-r17` (`2804704`). Items marked *(carried)* come from the 0.19.18 WARPSCOUT baseline and are still not router-verified.

## Done since the 2026-09-19 list (for reference, not re-open)

- BearGuard branding placement is settled: Services menu entry and page footers say **Podkop BearGuard**; Overview heading, Logs, Settings and Wizard keep **Podkop Bot** for the bot component (r2, r14).
- Forkop flavour detection: native generator path `/usr/lib/forkop/singbox/servers.uc` (was the never-existing `/usr/lib/singbox/servers.uc`), live `protocol='tailscale'` section as native evidence, `/usr/share/forkop/mirror-migration.sh` as positive Forkop X evidence; LuCI, rpcd and bot agree (r5, r13, r14).
- LuCI surfaces a native Tailscale section that the current provider does not own, and blocks creating a second node until it is resolved (r4).
- Multiline Telegram input keeps `user_id` (r13); mobile service matrix details open by tap on the served page (r16); Clash-down proxy card keeps subscription/proxy edits reachable (r17).
- sing-box restart alerts collapse into one flap summary after the third restart in 10 minutes (r7); sing-box version cache invalidates on binary change (r6).

## P0 — before calling 0.19.19 ready

- [ ] **Hardware-validate the tsnet multiprovider lifecycle end-to-end** on each reachable provider (forkop-native, forkop-x, classic podkop): create (disabled) → enable → `runtime_applied: true` plus a real tailnet registration → force a Podkop/Forkop config regeneration and see the endpoint drop → **Reapply** restores it → delete/purge cleans identity state. The r5 detection fix was reasoned from upstream sources and one router's UCI dump; the full lifecycle has no router-verified run yet.
- [ ] **Fix `tsnet-auto-repair.sh` cooldown placement** (still open at r17). The `transport_probe` readiness loop runs before the `COOLDOWN=300` check, so while auto-repair is on and the endpoint stays missing, live probes fire every cron tick (60 s) indefinitely. Check the cooldown (or a separate "probe attempted" stamp) before probing.
- [ ] **Bearhole extra listeners are inert until `hwelp-proxy` can bind them.** `hwelp-proxy` 0.1.1-r3 `make_listener()` rejects any address other than `127.0.0.1`/`::1` with `EACCES` (and binds hard-coded loopback even for those). Since r16 Bearhole handles this safely (extra addresses are skipped with `listener_skip reason=bind_unsupported`, loopback stays up), but no LAN/VPN listener actually runs. To make the r15 feature real:
  - bind `listen_host` in `hwelp-proxy` (ideally accept several `-l` in one process, so N listeners don't cost N× RSS on 256 MB routers);
  - decide the security rule first: non-loopback listeners should **require** local auth (not just a UI hint), and addresses in the `wan` firewall zone should be rejected;
  - publish the new hwelp through owfeed and GitHub release assets, and gate the LuCI field on a hwelp version/capability check (routers keep the old separate package for a while).
- [ ] **Router-verify the r17 Clash-down recovery card** on Forkop and Podkop Plus: break the subscription so sing-box fails to start → `Прокси` → `✏ URL подписки` → working URL → Podkop restarts and the proxy list returns.
- [ ] **Router-verify the r7 flap guard** on a low-RAM router (AX3000T_PETROVACY reported 13 restart alerts with 19 MB free): expect at most two individual alerts, one "флапает" summary, one "стабилизировался". Separately confirm the root cause there (`logread | grep -iE 'oom|out of memory|killed process'`).
- [ ] **Decide the standalone-`tailscaled`-running conflict UX once and audit that LuCI and the bot implement it identically** (confirm-once, backend re-check at mutation time, never touch the standalone service). Re-verify the earlier `ts_x_*`/`ts_r_*` confirm-gate fix survived `4bbead7`/`1430140`.
- [ ] **Router-verify Reapply and auto-repair don't race a live Podkop/Forkop reload** (`provider_busy()` covers `forkop.reload.lock` and a running `/usr/bin/podkop`; check Forkop X reloads that do not hold the lock for the whole config write).
- [ ] **Confirm `postinst` retires the old `podkop-tsnet-overlay` watcher on upgrade** from any 0.19.19 dev build before `2021e77`, including routers where it was restart-looping.

### Carried from the WARPSCOUT/WARP Rescue baseline

- [ ] *(carried)* Exact Rescue restore after manual hidden-runtime tests: capture the previous Rescue endpoint/state before a temporary test SOCKS starts, restore on completion or error.
- [ ] *(carried)* Persist per-endpoint TG status in the WARPSCOUT shortlist across `refreshView()`/reload.
- [ ] *(carried)* Overview WARP metadata when `active_snapshot` is empty/stale — resolve by the actual Rescue endpoint.
- [ ] *(carried)* Router-verify Stop WARP semantics (Rescue stops, magazine `0 / 0`, shortlist/discovery kept, later Reload rebuilds).
- [ ] *(carried)* Router-verify Reload/FIRE with Rescue already active (qualification uses the transient scan SOCKS; persistent Rescue is not replaced until FIRE succeeds).
- [ ] *(carried)* Regression-check POLL/FAST separation, including the WARP Rescue cascade tier's sticky/demotion behaviour.

## P1 — important UX / diagnostics

- [x] **HWELP GitHub fallback now has assets.** The 0.19.19 release (published by owfeed) carries signed `hwelp-proxy` IPK/APK for cortex-a53 and generic AArch64 plus an x86_64 IPK, so `bh_install_hwelp_github` can resolve them. Still open: the GitHub path installs with `apk --allow-untrusted` / plain `opkg install` and does not check the `.sig` files that now sit next to each asset.
- [ ] **Bearhole status reports PID/RSS of the first procd instance only**; once extra listeners really run, report per-instance or summed RSS.
- [ ] Make the all-routes final summary rich (outbound/server, country/provider/IP, Telegram result, service pass/fail, speed/TSPU, errors; collapsible details).
- [ ] Clarify Shortlist vs Magazine visually (WARPSCOUT).
- [ ] Remove/migrate legacy manual `WARP-SCOUT` fallback config entries instead of only filtering them.
- [ ] Finish the Russian UI language audit in rare dialogs/errors; keep protocol/API names and machine badges (`VALID`, `FAIL`, `POLL`, `FAST`, `ON-AIR`) unchanged.
- [ ] Audit tooltips on WARPSCOUT and Tailscale settings for overflow/accessibility on desktop/mobile themes.
- [ ] Add timestamps/age to Tailscale runtime status fields, so a stale `runtime_state` is not mistaken for current.
- [ ] Surface the auto-repair interval/cooldown in `tailscale.js` (`podkop_bot_tsnet_repair.status` already reports them).

## P2 — architecture / follow-up features

- [ ] Continuous WARP Rescue watchdog (process-death rotation without an open LuCI page).
- [ ] Write down the intended WARP Rescue failover semantics (it is a real `_try_all_tiers` tier now) against sticky POLL/FAST and recovery to higher tiers.
- [ ] Define Bearhole semantics beyond OpenWrt's own downloads before claiming it protects general system routing.
- [ ] Unify qualification/result storage across Settings, Revolver, Runtime and Overview.
- [ ] Deterministic state-machine tests: Discovery → qualification → magazine → FIRE → Stop/Reload; tsnet create → enable → drop → reapply/auto-repair → delete.
- [ ] Source check for the brand split (`Podkop BearGuard` for the app, `Podkop Bot` for the bot component) now that placement is settled, so they cannot drift silently.

## P3 — polish / release preparation

- [ ] Merge `CHANGELOG_DEV.md` into `CHANGELOG.md` when 0.19.19 is finalized.
- [ ] Refresh README screenshots (Runtime is two tabs, lamp-only service matrix, Tailscale and Bearhole pages).
- [ ] Finalize release notes only after hardware validation; no tag/release/merge to `main` without an explicit command.
- [ ] Confirm IPK/APK install and upgrade cleanly from the last public release (`0.19.17-2`), including the `podkop-tsnet-overlay` retirement path.
