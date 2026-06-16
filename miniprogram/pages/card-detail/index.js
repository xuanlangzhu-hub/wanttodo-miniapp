const cardApi = require("../../services/cards");

const STATUS_TEXT = {
  todo: "待整理",
  done: "已整理",
  archived: "已归档",
};

Page({
  data: {
    id: "",
    card: null,
    loggedIn: false,
    statusText: "",
  },

  onLoad(options) {
    this.syncAuthState();
    this.setData({ id: options.id || "" });
  },

  onShow() {
    this.syncAuthState();
    if (!this.data.loggedIn) {
      this.setData({ card: null, statusText: "" });
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    if (this.data.id) {
      this.loadCard();
    }
  },

  async loadCard() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    try {
      const card = await cardApi.getCard(this.data.id);
      this.setData({
        card: Object.assign({}, card, {
          createdAtText: this.formatTime(card.createdAt),
          updatedAtText: this.formatTime(card.updatedAt),
        }),
        statusText: STATUS_TEXT[card.status] || card.status || "",
      });
    } catch (error) {
      this.showError(error);
    }
  },

  onEditTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.navigateTo({
      url: `/pages/card-form/index?id=${this.data.id}`,
    });
  },

  onOrganizeTap() {
    this.onEditTap();
  },

  async onArchiveTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    try {
      await cardApi.archiveCard(this.data.id);
      wx.showToast({ title: "已归档", icon: "success" });
      this.loadCard();
    } catch (error) {
      this.showError(error);
    }
  },

  async onRestoreTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    try {
      await cardApi.updateCard(this.data.id, { status: "todo" });
      wx.showToast({ title: "已恢复", icon: "success" });
      this.loadCard();
    } catch (error) {
      this.showError(error);
    }
  },

  onDeleteTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

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
          await cardApi.deleteCard(this.data.id);
          wx.showToast({ title: "已移入回收站", icon: "success" });
          setTimeout(() => wx.navigateBack(), 350);
        } catch (error) {
          this.showError(error);
        }
      },
    });
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
      title: error.message || "操作失败",
      icon: "none",
    });
  },

  formatTime(value) {
    if (!value) {
      return "";
    }

    return String(value).replace("T", " ").slice(0, 16);
  },
});
