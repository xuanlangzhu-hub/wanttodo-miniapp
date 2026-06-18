const cardApi = require("../../services/cards");

const STATUS_LABELS = {
  done: "已整理",
  todo: "待整理",
  archived: "已归档",
};

Page({
  data: {
    keyword: "",
    tags: [],
    filteredTags: [],
    topTags: [],
    statusRows: [],
    totalCards: 0,
    donePercent: 0,
    loading: false,
    loggedIn: false,
  },

  onShow() {
    this.syncAuthState();
    if (!this.data.loggedIn) {
      this.resetData();
      return;
    }

    this.loadCatalog(false);
  },

  onPullDownRefresh() {
    if (!this.ensureLoggedIn(false)) {
      wx.stopPullDownRefresh();
      return;
    }

    this.loadCatalog(true).finally(() => wx.stopPullDownRefresh());
  },

  onKeywordInput(event) {
    const keyword = event.detail.value || "";
    this.setData({ keyword });
    this.updateFilteredTags(keyword, this.data.tags);
  },

  onSearchConfirm() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    const keyword = this.data.keyword.trim();
    if (!keyword) {
      return;
    }

    getApp().globalData.poolFilter = { keyword };
    wx.switchTab({ url: "/pages/content-pool/index" });
  },

  onTagTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    getApp().globalData.poolFilter = { tag: event.currentTarget.dataset.tag || "" };
    wx.switchTab({ url: "/pages/content-pool/index" });
  },

  onStatusTap(event) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    getApp().globalData.poolFilter = { status: event.currentTarget.dataset.status || "all" };
    wx.switchTab({ url: "/pages/content-pool/index" });
  },

  async loadCatalog(showLoading = false) {
    if (!this.ensureLoggedIn(false)) {
      this.resetData();
      return;
    }

    this.setData({ loading: true });
    try {
      const [tags, overview] = await Promise.all([
        cardApi.getTags(),
        cardApi.getOverview(),
      ]);
      const formattedTags = this.formatTags(tags || []);
      const statusRows = this.formatStatusRows(overview || {});
      const totalCards = statusRows.reduce((sum, item) => sum + item.count, 0);
      const done = overview && overview.doneCount ? overview.doneCount : 0;

      this.setData({
        tags: formattedTags,
        topTags: formattedTags.slice(0, 8),
        statusRows,
        totalCards,
        donePercent: totalCards ? Math.round((done / totalCards) * 100) : 0,
      });
      this.updateFilteredTags(this.data.keyword, formattedTags);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  formatTags(tags) {
    const sorted = tags
      .map((tag) => ({
        name: tag.name || "",
        count: tag.count || 0,
      }))
      .filter((tag) => tag.name)
      .sort((a, b) => b.count - a.count);
    return sorted.map((tag) => Object.assign({}, tag, {
      initial: tag.name.slice(0, 1).toUpperCase(),
    }));
  },

  formatStatusRows(overview) {
    const rows = [
      { label: STATUS_LABELS.done, value: "done", count: overview.doneCount || 0 },
      { label: STATUS_LABELS.todo, value: "todo", count: overview.todoCount || 0 },
      { label: STATUS_LABELS.archived, value: "archived", count: overview.archivedCount || 0 },
    ];
    const maxCount = rows.reduce((max, item) => Math.max(max, item.count), 0);

    return rows.map((item) => Object.assign({}, item, {
      percent: maxCount ? Math.max(6, Math.round((item.count / maxCount) * 100)) : 0,
    }));
  },

  updateFilteredTags(keyword, tags) {
    const normalized = (keyword || "").trim().toLowerCase();
    const filteredTags = normalized
      ? tags.filter((tag) => tag.name.toLowerCase().includes(normalized))
      : tags;

    this.setData({ filteredTags });
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
      tags: [],
      filteredTags: [],
      topTags: [],
      statusRows: this.formatStatusRows({}),
      totalCards: 0,
      donePercent: 0,
      loading: false,
    });
  },

  showError(error) {
    wx.showToast({
      title: error.message || "加载失败",
      icon: "none",
    });
  },
});
