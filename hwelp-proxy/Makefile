include $(TOPDIR)/rules.mk

PKG_NAME:=hwelp-proxy
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-or-later
PKG_MAINTAINER:=Medvedolog

include $(INCLUDE_DIR)/package.mk

define Package/hwelp-proxy
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Small HTTP to SOCKS/HTTP/direct failover proxy for Bearhole
  URL:=https://github.com/Medvedolog/luci-app-podkop-bot
  DEPENDS:=+libc
endef

define Package/hwelp-proxy/description
 HWELP proxy is the tiny native localhost gateway used by OpenWrt Bearhole.
 It accepts HTTP and CONNECT requests and forwards them through an ordered
 chain of SOCKS5/SOCKS5h, HTTP proxy or direct routes. No TLS library or
 external proxy daemon is required.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/hwelp-proxy.c $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CFLAGS) -std=c99 -Wall -Wextra \
		-DHWELP_VERSION=\"$(PKG_VERSION)\" \
		-o $(PKG_BUILD_DIR)/hwelp-proxy \
		$(PKG_BUILD_DIR)/hwelp-proxy.c $(TARGET_LDFLAGS)
endef

define Package/hwelp-proxy/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/hwelp-proxy $(1)/usr/bin/hwelp-proxy
endef

$(eval $(call BuildPackage,hwelp-proxy))
