const cardApi = require("../../services/cards");
const authApi = require("../../services/auth");

const STATUS_TABS = [
  { label: "全部", value: "all" },
  { label: "待整理", value: "todo" },
  { label: "已整理", value: "done" },
  { label: "已归档", value: "archived" },
];

const STATUS_TEXT = {
  todo: "待整理",
  done: "已整理",
  archived: "已归档",
};

const wxLogin = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });

Page({
  data: {
    statusTabs: STATUS_TABS,
    status: "all",
    cards: [],
    recentCards: [],
    pendingCards: [],
    overview: {
      todoCount: 0,
      doneCount: 0,
      archivedCount: 0,
      deletedCount: 0,
    },
    topTags: [],
    total: 0,
    page: 1,
    pageSize: 20,
    loading: false,
    loggedIn: false,
    userInfo: null,
    avatarText: "我",
  },

  onLoad() {
    this.syncAuthState();
    if (this.data.loggedIn) {
      this.loadCards(true);
    }
  },

  onShow() {
    this.syncAuthState();
    if (this.data.loggedIn) {
      this.loadCards(false);
    }
  },

  onPullDownRefresh() {
    this.loadCards(true).finally(() => wx.stopPullDownRefresh());
  },

  syncAuthState() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    this.setData({
      loggedIn: Boolean(app.globalData.token),
      userInfo,
      avatarText: this.getAvatarText(userInfo),
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
      this.loadCards(true);
    } catch (error) {
      this.showError(error);
    }
  },

  onCreateTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.navigateTo({
      url: "/pages/card-form/index",
    });
  },

  onCardTap(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/card-detail/index?id=${id}`,
    });
  },

  onOrganizeTap(event) {
    const { id } = event.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/card-form/index?id=${id}`,
    });
  },

  onTabTap(event) {
    const status = event.currentTarget.dataset.status;
    if (status === this.data.status) {
      return;
    }

    this.setData({ status, page: 1 });
    this.loadCards(true);
  },

  async onArchiveTap(event) {
    const { id } = event.currentTarget.dataset;
    try {
      await cardApi.archiveCard(id);
      wx.showToast({ title: "已归档", icon: "success" });
      this.loadCards(false);
    } catch (error) {
      this.showError(error);
    }
  },

  async onRestoreTap(event) {
    const { id } = event.currentTarget.dataset;
    try {
      await cardApi.updateCard(id, { status: "todo" });
      wx.showToast({ title: "已恢复", icon: "success" });
      this.loadCards(false);
    } catch (error) {
      this.showError(error);
    }
  },

  onDeleteTap(event) {
    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: "移入回收站",
      content: "确定把这张卡片移入回收站吗？",
      confirmText: "移除",
      confirmColor: "#ff7966",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }

        try {
          await cardApi.deleteCard(id);
          wx.showToast({ title: "已移入回收站", icon: "success" });
          this.loadCards(false);
        } catch (error) {
          this.showError(error);
        }
      },
    });
  },

  async loadCards(showLoading = false) {
    if (!this.data.loggedIn) {
      return Promise.resolve();
    }

    this.setData({ loading: true });
    try {
      const overview = await cardApi.getOverview();
      const result = await cardApi.getCards({
        page: 1,
        pageSize: this.data.pageSize,
        status: this.data.status,
        sort: "updatedAt",
        order: "desc",
        showLoading,
      });
      const pendingResult = await cardApi.getCards({
        page: 1,
        pageSize: 3,
        status: "todo",
        sort: "updatedAt",
        order: "desc",
      });

      const cards = this.formatCards(result.list || []);
      const recentCards = this.formatCards((overview && overview.recentCards) || []);
      const pendingCards = this.formatCards(pendingResult.list || []);
      this.setData({
        cards,
        total: result.total || 0,
        page: result.page || 1,
        pageSize: result.pageSize || this.data.pageSize,
        overview: Object.assign({
          todoCount: 0,
          doneCount: 0,
          archivedCount: 0,
          deletedCount: 0,
        }, overview || {}),
        recentCards: recentCards.slice(0, 3),
        pendingCards,
        topTags: (overview && overview.topTags) || [],
      });
    } catch (error) {
      if (error.statusCode === 401) {
        getApp().clearAuth();
        this.setData({
          loggedIn: false,
          userInfo: null,
          cards: [],
          recentCards: [],
          pendingCards: [],
          total: 0,
        });
      }
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  ensureLoggedIn() {
    if (this.data.loggedIn) {
      return true;
    }

    wx.showToast({ title: "请先登录", icon: "none" });
    return false;
  },

  showError(error) {
    wx.showToast({
      title: error.message || "操作失败",
      icon: "none",
    });
  },

  formatCards(cards) {
    return cards.map((card) => Object.assign({}, card, {
      statusText: STATUS_TEXT[card.status] || card.status || "",
      updatedAtText: this.formatTime(card.updatedAt),
    }));
  },

  formatTime(value) {
    if (!value) {
      return "";
    }

    return String(value).replace("T", " ").slice(0, 16);
  },

  getAvatarText(userInfo) {
    const nickname = userInfo && userInfo.nickname ? userInfo.nickname : "";
    return nickname ? nickname.slice(0, 1) : "我";
  },
});
