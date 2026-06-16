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
      });
    } catch (error) {
      this.showError(error);
    }
  },

  onInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  onStatusTap(event) {
    this.setData({
      "form.status": event.currentTarget.dataset.status,
    });
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

  ensureLoggedIn() {
    this.syncAuthState();
    if (this.data.loggedIn) {
      return true;
    }

    wx.showToast({ title: "请先登录", icon: "none" });
    return false;
  },

  showError(error) {
    wx.showToast({
      title: error.message || "保存失败",
      icon: "none",
    });
  },
});
