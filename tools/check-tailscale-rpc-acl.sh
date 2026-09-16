#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

python3 - <<'PY'
import json
import pathlib
import re
import sys

root = pathlib.Path('.')
rpc_path = root / 'root/usr/libexec/rpcd/podkop_bot_tailscale'
js_path = root / 'root/www/luci-static/resources/view/podkop-bot/tailscale.js'
acl_path = root / 'root/usr/share/rpcd/acl.d/luci-app-podkop-bot.json'

rpc = rpc_path.read_text()
js = js_path.read_text()
acl = json.loads(acl_path.read_text())['luci-app-podkop-bot']

# rpcd shell backend advertises methods from its list action.
m = re.search(r"list\)\s*\n\s*echo '(\{.*?\})'", rpc, re.S)
if not m:
    raise SystemExit('Tailscale RPC list JSON not found')
listed = set(json.loads(m.group(1)))

allowed = set(acl['read']['ubus'].get('podkop_bot_tailscale', []))
allowed |= set(acl['write']['ubus'].get('podkop_bot_tailscale', []))

frontend = set(re.findall(
    r"object:\s*'podkop_bot_tailscale'\s*,\s*method:\s*'([^']+)'",
    js,
    re.S,
))

errors = []
missing_acl = listed - allowed
missing_backend = frontend - listed
missing_frontend_acl = frontend - allowed

if missing_acl:
    errors.append(f'Tailscale backend methods missing from ACL: {sorted(missing_acl)}')
if missing_backend:
    errors.append(f'Tailscale frontend methods missing from backend list: {sorted(missing_backend)}')
if missing_frontend_acl:
    errors.append(f'Tailscale frontend methods missing from ACL: {sorted(missing_frontend_acl)}')

required = {'status', 'create', 'set_enabled', 'set_advertise_exit_node', 'set_accept_routes', 'delete'}
missing_required = required - listed
if missing_required:
    errors.append(f'Tailscale required RPC methods missing: {sorted(missing_required)}')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)

print(f'Tailscale RPC/ACL contract OK: {len(listed)} backend methods, {len(frontend)} frontend methods')
PY
