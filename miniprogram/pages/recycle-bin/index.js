const cardApi = require("../../services/cards");

const STATUS_TEXT = {
  todo: "待整理",
  done: "已整理",
  archived: "已归档",
};

Page({
  data: {
    cards: [],
    keyword: "",
    loading: false,
    loggedIn: false,
    navTop: 0,
    navHeight: 44,
    contentTop: 92,
    order: "desc",
    pageSize: 20,
    total: 0,
  },

  onLoad() {
    this.setNavMetrics();
  },

  onShow() {
    this.syncAuthState();
    if (!this.data.loggedIn) {
      this.resetData();
      return;
    }

    this.loadCards(false);
  },

  onPullDownRefresh() {
    if (!this.ensureLoggedIn(false)) {
      wx.stopPullDownRefresh();
      return;
    }

    this.loadCards(true).finally(() => wx.stopPullDownRefresh());
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value || "" });
  },

  onSearchConfirm() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    this.loadCards(true);
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.redirectTo({ url: "/pages/profile/index" });
  },

  onSortTap() {
    this.setData({
      order: this.data.order === "desc" ? "asc" : "desc",
    });
    if (this.ensureLoggedIn(false)) {
      this.loadCards(true);
    }
  },

  async onRestoreTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    try {
      await cardApi.restoreCard(event.currentTarget.dataset.id);
      wx.showToast({ title: "已恢复", icon: "success" });
      this.loadCards(false);
    } catch (error) {
      this.showError(error);
    }
  },

  onPermanentDeleteTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: "彻底删除",
      content: "彻底删除后无法恢复，确定继续吗？",
      confirmText: "删除",
      confirmColor: "#ff7966",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }

        try {
          await cardApi.permanentDeleteCard(id);
          wx.showToast({ title: "已彻底删除", icon: "success" });
          this.loadCards(false);
        } catch (error) {
          this.showError(error);
        }
      },
    });
  },

  async loadCards(showLoading = false) {
    if (!this.ensureLoggedIn(false)) {
      this.resetData();
      return;
    }

    this.setData({ loading: true });
    try {
      const result = await cardApi.getDeletedCards({
        page: 1,
        pageSize: this.data.pageSize,
        keyword: this.data.keyword,
        order: this.data.order,
        showLoading,
      });

      this.setData({
        cards: (result.list || []).map((card) => Object.assign({}, card, {
          deletedAtText: this.formatTime(card.deletedAt || card.updatedAt),
          statusText: STATUS_TEXT[card.status] || card.status || "",
        })),
        total: result.total || 0,
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  syncAuthState() {
    const app = getApp();
    this.setData({ loggedIn: Boolean(app.globalData.token) });
  },

  setNavMetrics() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const statusBarHeight = systemInfo.statusBarHeight || 0;
    const navHeight = menuButton ? menuButton.height + (menuButton.top - statusBarHeight) * 2 : 44;

    this.setData({
      navTop: statusBarHeight,
      navHeight,
      contentTop: statusBarHeight + navHeight + 32,
    });
  },

  ensureLoggedIn(showTip = true) {
    if (this.data.loggedIn) {
      return true;
    }

    if (showTip) {
      wx.showToast({ title: "请先登录", icon: "none" });
    }
    return false;
  },

  resetData() {
    this.setData({
      cards: [],
      total: 0,
      loading: false,
    });
  },

  formatTime(value) {
    return value ? String(value).replace("T", " ").slice(0, 16) : "";
  },

  showError(error) {
    wx.showToast({
      title: error.message || "操作失败",
      icon: "none",
    });
  },
});
