const cardApi = require("../../services/cards");

Page({
  data: {
    cards: [],
    total: 0,
    loading: false,
    loggedIn: false,
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

  onCardTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.navigateTo({
      url: `/pages/card-detail/index?id=${event.currentTarget.dataset.id}`,
    });
  },

  onOrganizeTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.navigateTo({
      url: `/pages/card-form/index?id=${event.currentTarget.dataset.id}`,
    });
  },

  async onArchiveTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    try {
      await cardApi.archiveCard(event.currentTarget.dataset.id);
      wx.showToast({ title: "已归档", icon: "success" });
      this.loadCards(false);
    } catch (error) {
      this.showError(error);
    }
  },

  async loadCards(showLoading = false) {
    if (!this.ensureLoggedIn(false)) {
      this.resetData();
      return;
    }

    this.setData({ loading: true });
    try {
      const result = await cardApi.getCards({
        page: 1,
        pageSize: 50,
        status: "todo",
        sort: "updatedAt",
        order: "desc",
        showLoading,
      });

      this.setData({
        cards: (result.list || []).map((card) => Object.assign({}, card, {
          updatedAtText: card.updatedAt ? String(card.updatedAt).replace("T", " ").slice(0, 16) : "",
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

  showError(error) {
    wx.showToast({
      title: error.message || "操作失败",
      icon: "none",
    });
  },
});
