const cardApi = require("../../services/cards");

Page({
  data: {
    userInfo: null,
    avatarText: "我",
    total: 0,
    pending: 0,
    done: 0,
    archived: 0,
    deleted: 0,
  },

  onShow() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    this.setData({
      userInfo,
      avatarText: this.getAvatarText(userInfo),
    });
    this.loadStats();
  },

  async loadStats() {
    try {
      const overview = await cardApi.getOverview();
      this.setData({
        total: (overview.todoCount || 0) + (overview.doneCount || 0) + (overview.archivedCount || 0),
        pending: overview.todoCount || 0,
        done: overview.doneCount || 0,
        archived: overview.archivedCount || 0,
        deleted: overview.deletedCount || 0,
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    }
  },

  onRecycleTap() {
    wx.navigateTo({ url: "/pages/recycle-bin/index" });
  },

  onLogoutTap() {
    wx.showModal({
      title: "退出登录",
      content: "确定退出当前账号吗？",
      confirmText: "退出",
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        getApp().clearAuth();
        wx.redirectTo({ url: "/pages/index/index" });
      },
    });
  },

  getAvatarText(userInfo) {
    const nickname = userInfo && userInfo.nickname ? userInfo.nickname : "";
    return nickname ? nickname.slice(0, 1) : "我";
  },
});
