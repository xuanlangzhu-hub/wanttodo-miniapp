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
  suggestionTimer: null,

  data: {
    statusTabs: STATUS_TABS,
    status: "all",
    cards: [],
    keyword: "",
    suggestions: {
      keywords: [],
      tags: [],
      cards: [],
    },
    showSuggestions: false,
    selectedTag: "",
    total: 0,
    pageSize: 20,
    loading: false,
    loggedIn: false,
  },

  onLoad(options = {}) {
    if (options.status) {
      this.setData({ status: options.status });
    }
    if (options.keyword) {
      this.setData({ keyword: decodeURIComponent(options.keyword) });
    }
    if (options.tag) {
      this.setData({ selectedTag: decodeURIComponent(options.tag) });
    }
  },

  onShow() {
    this.syncAuthState();
    this.applyPendingFilter();
    if (!this.data.loggedIn) {
      this.resetData();
      return;
    }

    this.loadCards(false);
  },

  applyPendingFilter() {
    const app = getApp();
    const filter = app.globalData.poolFilter;
    if (!filter) {
      return;
    }

    app.globalData.poolFilter = null;
    this.setData({
      status: filter.status || "all",
      keyword: filter.keyword || "",
      selectedTag: filter.tag || "",
    });
  },

  onPullDownRefresh() {
    if (!this.ensureLoggedIn(false)) {
      wx.stopPullDownRefresh();
      return;
    }

    this.loadCards(true).finally(() => wx.stopPullDownRefresh());
  },

  onUnload() {
    this.clearSuggestions();
  },

  onTabTap(event) {
    const status = event.currentTarget.dataset.status;
    if (status === this.data.status) {
      return;
    }

    this.setData({ status });
    if (!this.ensureLoggedIn()) {
      return;
    }
    this.loadCards(true);
  },

  onKeywordInput(event) {
    const keyword = event.detail.value || "";
    this.setData({ keyword });
    this.queueSuggestions(keyword);
  },

  onSearchConfirm() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    this.clearSuggestions();
    this.loadCards(true);
  },

  onSuggestionKeywordTap(event) {
    const keyword = event.currentTarget.dataset.keyword || "";
    this.setData({ keyword });
    this.clearSuggestions();
    this.loadCards(true);
  },

  onSuggestionTagTap(event) {
    const tag = event.currentTarget.dataset.tag || "";
    this.setData({
      selectedTag: tag,
      keyword: "",
    });
    this.clearSuggestions();
    this.loadCards(true);
  },

  onSuggestionCardTap(event) {
    this.clearSuggestions();
    wx.navigateTo({
      url: `/pages/card-detail/index?id=${event.currentTarget.dataset.id}`,
    });
  },

  onClearTagTap() {
    if (!this.data.selectedTag) {
      return;
    }

    this.setData({ selectedTag: "" });
    if (!this.ensureLoggedIn()) {
      return;
    }
    this.loadCards(true);
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

  async onRestoreTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    try {
      await cardApi.updateCard(event.currentTarget.dataset.id, { status: "todo" });
      wx.showToast({ title: "已恢复", icon: "success" });
      this.loadCards(false);
    } catch (error) {
      this.showError(error);
    }
  },

  onDeleteTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

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
    if (!this.ensureLoggedIn(false)) {
      this.resetData();
      return;
    }

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

  queueSuggestions(keyword) {
    if (this.suggestionTimer) {
      clearTimeout(this.suggestionTimer);
    }

    const trimmed = (keyword || "").trim();
    if (!trimmed || !this.data.loggedIn) {
      this.clearSuggestions();
      return;
    }

    this.suggestionTimer = setTimeout(() => {
      this.loadSuggestions(trimmed);
    }, 260);
  },

  async loadSuggestions(keyword) {
    try {
      const suggestions = await cardApi.getSuggestions({ keyword, limit: 6 });
      this.setData({
        suggestions: {
          keywords: suggestions.keywords || [],
          tags: suggestions.tags || [],
          cards: suggestions.cards || [],
        },
        showSuggestions: Boolean(
          (suggestions.keywords && suggestions.keywords.length) ||
          (suggestions.tags && suggestions.tags.length) ||
          (suggestions.cards && suggestions.cards.length)
        ),
      });
    } catch (error) {
      this.clearSuggestions();
    }
  },

  clearSuggestions() {
    if (this.suggestionTimer) {
      clearTimeout(this.suggestionTimer);
      this.suggestionTimer = null;
    }
    this.setData({
      suggestions: {
        keywords: [],
        tags: [],
        cards: [],
      },
      showSuggestions: false,
    });
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
