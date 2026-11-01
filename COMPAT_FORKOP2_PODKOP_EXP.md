# Forkop 2.0 / Podkop Experimental 0.8.x compatibility: RC work

This branch introduces *fail-closed compatibility*, not full feature parity.

## Confirmed upstream changes

- Forkop 2.0 migrates per-section `mixed_proxy_*` to `server` (`protocol=mixed`, `routing_mode=section`), and Tailscale native options to `tunnel` (`kind=tailscale`).
- Forkop 2 uses `sing-box-forkop` and its own package version compatibility checks.
- Podkop Experimental installs `podkop-exp`, preserves `/etc/config/podkop`, and embeds sing-box in its Go backend. The upstream installer may remove incompatible packages with explicit consent.

## Included safety changes

1. Detect these backends from installed package and UCI version, not just stale filenames.
2. Read Forkop 2 mixed listeners from routed `server` records in status, runtime sections and transport.
3. Return explicit unsupported errors for legacy mixed-proxy write RPCs on Forkop 2.
4. Read-only native Tailscale detection for Forkop 2. Mutating legacy `server` records is denied. Podkop Experimental has no external JSON Tailscale overlay.
5. Refuse unattended Experimental updates and use the native Forkop 2 installer logic for core upgrades.
6. Show embedded/packaged core identity without launching a second Go process, and sync embedded Telegram bot.

## Known gaps / do not enable yet

- Full editing of Forkop 2 subscriptions, priorities, tunnels and DNS through the legacy Telegram/LuCI editor.
- Forkop 2 native Tailscale create/delete/update, and `server_client` credential handling.
- Physical tests of routing, failover, state migration and safe upgrade over a proxy-only WAN.

## Verify source-level guards

```sh
sh tools/check-provider-compat.sh
sh tools/check-async-wrappers.sh
```

Do not mark this branch stable or merge until hardware regression tests pass.
