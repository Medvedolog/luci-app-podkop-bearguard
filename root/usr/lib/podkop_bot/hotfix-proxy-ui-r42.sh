#!/bin/sh
# r42 compatibility hotfix for the vendored/installed podkop_bot.
# Idempotent: patches only the known 0.19.18 proxy-chain UI signatures.
set -u

patch_one() {
    _f="$1"
    [ -f "$_f" ] || return 0
    grep -q '# r42-proxy-ui' "$_f" 2>/dev/null && return 0

    _tmp="${_f}.r42.$$"
    awk '
    {
        print

        # Settings badge: WARP Rescue is a real proxy transport and must be
        # counted together with tier1/tier2/tier3. Direct/emergency stay out.
        if ($0 ~ /\[ "\$cp" != "Not set" \] && _cp_n=\$\(\(_cp_n \+ 1\)\)/) {
            print "            [ \"$(_warp_rescue_cfg_get enabled 2>/dev/null || true)\" = \"1\" ] && _cp_n=$((_cp_n + 1)) # r42-proxy-ui"
        }

        # Resolve the actual WARP endpoint and human metadata from WARPSCOUT.
        if ($0 ~ /_wr_lat=\$\(grep '\''\^warp_rescue='\''/) {
            print "                local _wr_ep _wr_node _wr_loc _wr_meta"
            print "                _wr_ep=$(sed -n '\''s/^endpoint=//p'\'' /tmp/podkop_bot/warpscout_rescue.state 2>/dev/null | head -n1)"
            print "                [ -z \"$_wr_ep\" ] && _wr_ep=$(_warp_rescue_cfg_get active_endpoint 2>/dev/null || true)"
            print "                _wr_meta=$(awk -F'\''|'\'' -v e=\"$_wr_ep\" '\''$1==e {print $6 \"|\" $7; exit}'\'' /etc/podkop_bot/warpscout-shortlist.tsv 2>/dev/null)"
            print "                _wr_node=${_wr_meta%%|*}; _wr_loc=${_wr_meta#*|}"
            print "                [ \"$_wr_loc\" = \"$_wr_meta\" ] && _wr_loc=\"\""
        }

        # Add actual WARP egress identity under the local SOCKS transport row.
        if ($0 ~ /^                    \"\$list_text\" \"\$_row_lbl\" \"\$_wr_port\" \"\$_wr_state\"\)$/) {
            print "                if [ -n \"$_wr_ep\" ]; then"
            print "                    local _wr_desc=\"Сервер выхода: $_wr_ep\""
            print "                    [ -n \"$_wr_loc\" ] && _wr_desc=\"${_wr_desc} · $_wr_loc\""
            print "                    [ -n \"$_wr_node\" ] && _wr_desc=\"${_wr_desc} · $_wr_node\""
            print "                    list_text=\"${list_text}"
            print "<i>${_wr_desc}</i>\""
            print "                fi"
        }

        # The historical printf strings contain literal backslashes before
        # newlines. Sanitize the final Telegram card only; proxy values/config
        # are untouched.
        if ($0 ~ /^                \"\$E_NET\" \"\$E_PLAY\" \"\$list_text\"\)$/) {
            print "            text=$(printf '\''%s'\'' \"$text\" | tr -d '\''\\\\'\'') # r42-proxy-ui"
        }
    }
    ' "$_f" > "$_tmp" || { rm -f "$_tmp"; return 1; }

    if grep -q '# r42-proxy-ui' "$_tmp" 2>/dev/null; then
        chmod --reference="$_f" "$_tmp" 2>/dev/null || chmod +x "$_tmp" 2>/dev/null || true
        mv "$_tmp" "$_f"
    else
        rm -f "$_tmp"
        return 1
    fi
}

patch_one /usr/lib/podkop_bot/podkop_bot || true
patch_one /usr/bin/podkop_bot || true
exit 0
