const cardApi = require("../../services/cards");

Page({
  data: {
    cards: [],
    total: 0,
    loading: false,
  },

  onShow() {
    this.loadCards(false);
  },

  onPullDownRefresh() {
    this.loadCards(true).finally(() => wx.stopPullDownRefresh());
  },

  onCardTap(event) {
    wx.navigateTo({
      url: `/pages/card-detail/index?id=${event.currentTarget.dataset.id}`,
    });
  },

  onOrganizeTap(event) {
    wx.navigateTo({
      url: `/pages/card-form/index?id=${event.currentTarget.dataset.id}`,
    });
  },

  async onArchiveTap(event) {
    try {
      await cardApi.archiveCard(event.currentTarget.dataset.id);
      wx.showToast({ title: "已归档", icon: "success" });
      this.loadCards(false);
    } catch (error) {
      this.showError(error);
    }
  },

  async loadCards(showLoading = false) {
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

  showError(error) {
    wx.showToast({
      title: error.message || "操作失败",
      icon: "none",
    });
  },
});
