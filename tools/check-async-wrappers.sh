#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

for f in root/www/luci-static/resources/view/podkop-bot/*-async.js; do
    [ -f "$f" ] || continue
    grep -Fq 'return base.constructor.extend({' "$f" || {
        echo "LuCI async wrapper must return a class constructor: $f" >&2
        exit 1
    }
    if grep -Fq 'return base;' "$f"; then
        echo "LuCI async wrapper returns injected instance: $f" >&2
        exit 1
    fi
done

echo "LuCI async wrapper constructor contract OK"
