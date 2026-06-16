const cardApi = require("../../services/cards");

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

Page({
  data: {
    statusTabs: STATUS_TABS,
    status: "all",
    cards: [],
    keyword: "",
    selectedTag: "",
    tags: [],
    total: 0,
    pageSize: 20,
    loading: false,
  },

  onLoad(options = {}) {
    if (options.status) {
      this.setData({ status: options.status });
    }
  },

  onShow() {
    this.loadTags();
    this.loadCards(false);
  },

  onPullDownRefresh() {
    this.loadCards(true).finally(() => wx.stopPullDownRefresh());
  },

  onTabTap(event) {
    const status = event.currentTarget.dataset.status;
    if (status === this.data.status) {
      return;
    }

    this.setData({ status });
    this.loadCards(true);
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value || "" });
  },

  onSearchConfirm() {
    this.loadCards(true);
  },

  onTagTap(event) {
    const tag = event.currentTarget.dataset.tag || "";
    this.setData({
      selectedTag: tag === this.data.selectedTag ? "" : tag,
    });
    this.loadCards(true);
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

  async onRestoreTap(event) {
    try {
      await cardApi.updateCard(event.currentTarget.dataset.id, { status: "todo" });
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
    this.setData({ loading: true });
    try {
      const result = await cardApi.getCards({
        page: 1,
        pageSize: this.data.pageSize,
        status: this.data.status,
        keyword: this.data.keyword,
        tag: this.data.selectedTag,
        sort: "updatedAt",
        order: "desc",
        showLoading,
      });

      this.setData({
        cards: this.formatCards(result.list || []),
        total: result.total || 0,
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadTags() {
    try {
      const tags = await cardApi.getTags();
      this.setData({ tags: tags || [] });
    } catch (error) {
      this.setData({ tags: [] });
    }
  },

  formatCards(cards) {
    return cards.map((card) => Object.assign({}, card, {
      statusText: STATUS_TEXT[card.status] || card.status || "",
      updatedAtText: this.formatTime(card.updatedAt),
    }));
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
