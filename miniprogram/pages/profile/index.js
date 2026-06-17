const cardApi = require("../../services/cards");
const authApi = require("../../services/auth");

const wxLogin = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });

Page({
  data: {
    userInfo: null,
    avatarText: "我",
    loggedIn: false,
    total: 0,
    pending: 0,
    done: 0,
    archived: 0,
    deleted: 0,
    tagCount: 0,
  },

  onShow() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    const loggedIn = Boolean(app.globalData.token);
    this.setData({
      loggedIn,
      userInfo,
      avatarText: this.getAvatarText(userInfo),
    });

    if (!loggedIn) {
      this.resetStats();
      return;
    }

    this.loadStats();
  },

  async loadStats() {
    if (!this.data.loggedIn) {
      this.resetStats();
      return;
    }

    try {
      const [overview, tags] = await Promise.all([
        cardApi.getOverview(),
        cardApi.getTags(),
      ]);
      this.setData({
        total: (overview.todoCount || 0) + (overview.doneCount || 0) + (overview.archivedCount || 0),
        pending: overview.todoCount || 0,
        done: overview.doneCount || 0,
        archived: overview.archivedCount || 0,
        deleted: overview.deletedCount || 0,
        tagCount: (tags || []).length,
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    }
  },

  onRecycleTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.navigateTo({ url: "/pages/recycle-bin/index" });
  },

  onPoolTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.redirectTo({ url: "/pages/content-pool/index" });
  },

  onCategoryTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.redirectTo({ url: "/pages/pending/index" });
  },

  onStatusTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.redirectTo({
      url: `/pages/content-pool/index?status=${event.currentTarget.dataset.status}`,
    });
  },

  async onLoginTap() {
    try {
      const loginResult = await wxLogin();
      if (!loginResult.code) {
        throw new Error("登录失败");
      }

      const authData = await authApi.wechatLogin(loginResult.code);
      getApp().setAuth(authData.token, authData.userInfo);
      this.setData({
        loggedIn: true,
        userInfo: authData.userInfo,
        avatarText: this.getAvatarText(authData.userInfo),
      });
      wx.showToast({ title: "登录成功", icon: "success" });
      this.loadStats();
    } catch (error) {
      this.showError(error);
    }
  },

  onAuthButtonTap() {
    if (!this.data.loggedIn) {
      this.onLoginTap();
      return;
    }

    wx.showModal({
      title: "退出登录",
      content: "确定退出当前账号吗？",
      confirmText: "退出",
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        getApp().clearAuth();
        this.setData({
          loggedIn: false,
          userInfo: null,
          avatarText: "我",
        });
        this.resetStats();
      },
    });
  },

  ensureLoggedIn() {
    if (this.data.loggedIn) {
      return true;
    }

    wx.showToast({ title: "请先登录", icon: "none" });
    return false;
  },

  resetStats() {
    this.setData({
      total: 0,
      pending: 0,
      done: 0,
      archived: 0,
      deleted: 0,
      tagCount: 0,
    });
  },

  showError(error) {
    wx.showToast({
      title: error.message || "操作失败",
      icon: "none",
    });
  },

  getAvatarText(userInfo) {
    const nickname = userInfo && userInfo.nickname ? userInfo.nickname : "";
    return nickname ? nickname.slice(0, 1) : "我";
  },
});
