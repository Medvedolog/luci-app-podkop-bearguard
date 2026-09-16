#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

F=root/usr/lib/podkop_bot/tsnet-overlay-watch.sh

[ -f "$F" ] || { echo "FAIL  tsnet overlay watcher missing" >&2; exit 1; }
sh -n "$F"

grep -Fq 'RESTART_GUARD_LIMIT=1' "$F" || { echo "FAIL  tsnet restart guard limit missing" >&2; exit 1; }
grep -Fq 'overlay_restart_circuit_open' "$F" || { echo "FAIL  tsnet restart circuit-open event missing" >&2; exit 1; }
grep -Fq 'restart=suppressed reason=circuit_open' "$F" || { echo "FAIL  tsnet restart suppression missing" >&2; exit 1; }
grep -Fq 'restart_guard_reset' "$F" || { echo "FAIL  explicit restart-guard reset missing" >&2; exit 1; }
grep -Fq 'if [ "$1" = "--once" ]; then' "$F" || { echo "FAIL  explicit one-shot apply path missing" >&2; exit 1; }

# The watcher may request at most one sing-box restart before the circuit opens.
# Rollback is allowed to restart only after a failed first restart; the circuit
# guard must be located before the normal restart call.
python3 - <<'PY'
from pathlib import Path
s = Path('root/usr/lib/podkop_bot/tsnet-overlay-watch.sh').read_text()
guard = s.find('if ! restart_guard_allow; then')
normal = s.find('if /etc/init.d/sing-box restart >/dev/null 2>&1; then')
if guard < 0 or normal < 0 or guard > normal:
    raise SystemExit('FAIL  restart circuit breaker does not guard normal restart')
print('tsnet overlay restart circuit-breaker contract OK')
PY
