const config = require("./config");

App({
  onLaunch: function () {
    this.globalData = {
      baseUrl: config.baseUrl,
      token: wx.getStorageSync("token") || "",
      userInfo: wx.getStorageSync("userInfo") || null,
    };
  },

  setAuth(token, userInfo) {
    this.globalData.token = token || "";
    this.globalData.userInfo = userInfo || null;
    wx.setStorageSync("token", this.globalData.token);
    wx.setStorageSync("userInfo", this.globalData.userInfo);
  },

  clearAuth() {
    this.globalData.token = "";
    this.globalData.userInfo = null;
    wx.removeStorageSync("token");
    wx.removeStorageSync("userInfo");
  },
});
