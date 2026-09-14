#
# Copyright (C) 2026 Medvedolog
#
# This is free software, licensed under the GNU General Public License v2.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-podkop-bot
PKG_VERSION:=0.19.18
PKG_RELEASE:=23

PKG_MAINTAINER:=Medvedolog
PKG_LICENSE:=GPL-2.0-or-later

LUCI_TITLE:=LuCI interface for podkop_bot (Telegram bot for podkop/sing-box)
# Bearhole's standalone gateway uses optional ucode socket/struct/uloop modules,
# but they must not be hard dependencies of the management package: Bearhole is
# an emergency/bootstrap feature and a broken package feed must never prevent
# luci-app-podkop-bot itself from being installed or repaired. The RPC/UI gate
# Bearhole activation when its engine runtime is unavailable.
LUCI_DEPENDS:=+luci-base +jq +curl
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
$(eval $(call BuildPackage,$(PKG_NAME)))
