const cardApi = require("../../services/cards");

Page({
  data: {
    cards: [],
    keyword: "",
    loading: false,
    pageSize: 20,
    total: 0,
  },

  onShow() {
    this.loadCards(false);
  },

  onPullDownRefresh() {
    this.loadCards(true).finally(() => wx.stopPullDownRefresh());
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value || "" });
  },

  onSearchConfirm() {
    this.loadCards(true);
  },

  async onRestoreTap(event) {
    try {
      await cardApi.restoreCard(event.currentTarget.dataset.id);
      wx.showToast({ title: "已恢复", icon: "success" });
      this.loadCards(false);
    } catch (error) {
      this.showError(error);
    }
  },

  onPermanentDeleteTap(event) {
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
    this.setData({ loading: true });
    try {
      const result = await cardApi.getDeletedCards({
        page: 1,
        pageSize: this.data.pageSize,
        keyword: this.data.keyword,
        showLoading,
      });

      this.setData({
        cards: (result.list || []).map((card) => Object.assign({}, card, {
          deletedAtText: this.formatTime(card.deletedAt || card.updatedAt),
        })),
        total: result.total || 0,
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
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
