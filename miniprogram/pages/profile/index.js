const cardApi = require("../../services/cards");

Page({
  data: {
    userInfo: null,
    avatarText: "我",
    total: 0,
    pending: 0,
    done: 0,
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
      const result = await cardApi.getCards({
        page: 1,
        pageSize: 100,
        status: "all",
        sort: "updatedAt",
        order: "desc",
      });
      const cards = result.list || [];
      this.setData({
        total: result.total || cards.length,
        pending: cards.filter((card) => card.status === "todo").length,
        done: cards.filter((card) => card.status === "done").length,
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    }
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
