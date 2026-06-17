const cardApi = require("../../services/cards");

const STATUS_OPTIONS = [
  { label: "待整理", value: "todo" },
  { label: "已整理", value: "done" },
  { label: "已归档", value: "archived" },
];

const splitTags = (value) =>
  (value || "")
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

Page({
  data: {
    id: "",
    loggedIn: false,
    mode: "create",
    organizing: false,
    presetTags: [],
    presetTagItems: [],
    selectedTags: [],
    navTop: 0,
    navHeight: 44,
    contentTop: 92,
    statusOptions: STATUS_OPTIONS,
    form: {
      title: "",
      sourceText: "",
      summary: "",
      sourceUrl: "",
      tagsText: "",
      status: "todo",
    },
  },

  onLoad(options = {}) {
    this.setNavMetrics();
    this.syncAuthState();
    if (!this.data.loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    if (options.id) {
      this.setData({
        id: options.id,
        mode: "edit",
      });
      wx.setNavigationBarTitle({ title: "编辑卡片" });
      this.loadCard(options.id);
    }
    this.loadPresetTags();
  },

  setNavMetrics() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButton = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    const statusBarHeight = systemInfo.statusBarHeight || 0;
    const navHeight = menuButton ? menuButton.height + (menuButton.top - statusBarHeight) * 2 : 44;

    this.setData({
      navTop: statusBarHeight,
      navHeight,
      contentTop: statusBarHeight + navHeight + 24,
    });
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.redirectTo({ url: "/pages/index/index" });
  },

  async loadCard(id) {
    if (!this.ensureLoggedIn()) {
      return;
    }

    try {
      const card = await cardApi.getCard(id);
      this.setData({
        form: {
          title: card.title || "",
          sourceText: card.sourceText || "",
          summary: card.summary || "",
          sourceUrl: card.sourceUrl || "",
          tagsText: (card.tags || []).join(" "),
          status: card.status || "todo",
        },
        selectedTags: card.tags || [],
      });
      this.updatePresetTagItems(card.tags || [], this.data.presetTags);
    } catch (error) {
      this.showError(error);
    }
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset;
    const value = event.detail.value;
    const patch = {
      [`form.${field}`]: value,
    };
    if (field === "tagsText") {
      patch.selectedTags = splitTags(value);
      patch.presetTagItems = this.formatPresetTagItems(this.data.presetTags, patch.selectedTags);
    }
    this.setData(patch);
  },

  onStatusTap(event) {
    this.setData({
      "form.status": event.currentTarget.dataset.status,
    });
  },

  onPresetTagTap(event) {
    const tag = event.currentTarget.dataset.tag || "";
    const tags = splitTags(this.data.form.tagsText);
    const nextTags = tags.includes(tag)
      ? tags.filter((item) => item !== tag)
      : tags.concat(tag);

    this.setData({
      "form.tagsText": nextTags.join(" "),
      selectedTags: nextTags,
      presetTagItems: this.formatPresetTagItems(this.data.presetTags, nextTags),
    });
  },

  async onOrganizeTap() {
    if (this.data.organizing) {
      return;
    }

    if (!this.ensureLoggedIn()) {
      return;
    }

    const sourceText = this.data.form.sourceText.trim();
    if (!sourceText) {
      wx.showToast({ title: "请先填写内容", icon: "none" });
      return;
    }

    this.setData({ organizing: true });
    try {
      const result = await cardApi.organizeCard({
        sourceText,
        sourceUrl: this.data.form.sourceUrl.trim(),
      });
      const nextTags = result.tags && result.tags.length ? result.tags.join(" ") : this.data.form.tagsText;

      this.setData({
        "form.title": result.title || this.data.form.title,
        "form.summary": result.summary || this.data.form.summary,
        "form.tagsText": nextTags,
        selectedTags: splitTags(nextTags),
        presetTagItems: this.formatPresetTagItems(this.data.presetTags, splitTags(nextTags)),
        "form.status": result.status || this.data.form.status || "todo",
      });
      wx.showToast({ title: "已生成整理建议", icon: "success" });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ organizing: false });
    }
  },

  async onSaveTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    const form = this.data.form;
    const title = form.title.trim();
    if (!title) {
      wx.showToast({ title: "请填写标题", icon: "none" });
      return;
    }

    const payload = {
      title,
      sourceText: form.sourceText.trim(),
      summary: form.summary.trim(),
      sourceUrl: form.sourceUrl.trim(),
      tags: splitTags(form.tagsText),
      status: form.status,
    };

    try {
      let card;
      if (this.data.mode === "edit") {
        card = await cardApi.updateCard(this.data.id, payload);
      } else {
        card = await cardApi.createCard(payload);
      }

      wx.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/card-detail/index?id=${card.id || this.data.id}`,
        });
      }, 350);
    } catch (error) {
      this.showError(error);
    }
  },

  syncAuthState() {
    const app = getApp();
    this.setData({ loggedIn: Boolean(app.globalData.token) });
  },

  async loadPresetTags() {
    if (!this.ensureLoggedIn(false)) {
      this.setData({ presetTags: [] });
      return;
    }

    try {
      const tags = await cardApi.getPresetTags();
      this.setData({
        presetTags: tags || [],
        presetTagItems: this.formatPresetTagItems(tags || [], this.data.selectedTags),
      });
    } catch (error) {
      this.setData({ presetTags: [] });
    }
  },

  updatePresetTagItems(selectedTags, presetTags) {
    this.setData({
      presetTagItems: this.formatPresetTagItems(presetTags || [], selectedTags || []),
    });
  },

  formatPresetTagItems(presetTags, selectedTags) {
    return (presetTags || []).map((tag) => ({
      name: tag,
      selected: (selectedTags || []).includes(tag),
    }));
  },

  ensureLoggedIn(showTip = true) {
    this.syncAuthState();
    if (this.data.loggedIn) {
      return true;
    }

    if (showTip) {
      wx.showToast({ title: "请先登录", icon: "none" });
    }
    return false;
  },

  showError(error) {
    wx.showToast({
      title: error.message || "保存失败",
      icon: "none",
    });
  },
});
