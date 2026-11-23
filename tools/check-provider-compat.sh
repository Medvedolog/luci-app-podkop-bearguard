#!/bin/sh
# Source contract for the experimental embedded core and Forkop 2 UCI model.
set -eu
cd "$(dirname "$0")/.."
for path in root/usr/libexec/rpcd/podkop_bot root/usr/libexec/rpcd/podkop_bot_tailscale \
    root/usr/lib/podkop_bot/tsnet-provider.sh root/usr/lib/podkop_bot/tsnet-runtime-apply.sh \
    root/usr/lib/podkop_bot/podkop_bot; do
    sh -n "$path" || { echo "Syntax error: $path" >&2; exit 1; }
done
grep -Fq 'podkop-exp) printf' root/usr/libexec/rpcd/podkop_bot
grep -Fq 'podkop-net/podkop-experimental' root/usr/libexec/rpcd/podkop_bot
grep -Fq '_forkop_mixed_server()' root/usr/libexec/rpcd/podkop_bot
grep -Fq '_forkop_v2_read_only' root/usr/libexec/rpcd/podkop_bot
grep -Fq 'manual_update_required' root/usr/libexec/rpcd/podkop_bot
grep -Fq 'exit_advertisement_is_core_managed' root/usr/libexec/rpcd/podkop_bot_tailscale
grep -Fq 'embedded_core_unsupported' root/usr/libexec/rpcd/podkop_bot_tailscale
grep -Fq 'podkop-exp) return 1' root/usr/lib/podkop_bot/tsnet-provider.sh
grep -Fq 'podkop|forkop-x)' root/usr/lib/podkop_bot/tsnet-runtime-apply.sh
sh tools/test-forkop2-mixed-port.sh
sh tools/test-forkop2-tailscale-native.sh root/usr/lib/podkop_bot/podkop_bot
sh tools/test-0202-compat.sh root/usr/lib/podkop_bot/podkop_bot root/usr/libexec/rpcd/podkop_bot
# Ensure the embedded bot is the exact validated build (vendor.sha256).
(cd root/usr/lib/podkop_bot && sha256sum -c vendor.sha256)
grep -Fq '_group_selected_human_name()' root/usr/lib/podkop_bot/podkop_bot
grep -Fq '_forkop_native_human_label()' root/usr/lib/podkop_bot/podkop_bot
printf '%s\n' 'BearGuard embedded/native compatibility guards OK'
