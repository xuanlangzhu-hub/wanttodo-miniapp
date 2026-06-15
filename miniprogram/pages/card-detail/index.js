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
    statusText: "",
  },

  onLoad(options) {
    this.setData({ id: options.id || "" });
  },

  onShow() {
    if (this.data.id) {
      this.loadCard();
    }
  },

  async loadCard() {
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
    wx.navigateTo({
      url: `/pages/card-form/index?id=${this.data.id}`,
    });
  },

  onOrganizeTap() {
    this.onEditTap();
  },

  async onArchiveTap() {
    try {
      await cardApi.archiveCard(this.data.id);
      wx.showToast({ title: "已归档", icon: "success" });
      this.loadCard();
    } catch (error) {
      this.showError(error);
    }
  },

  async onRestoreTap() {
    try {
      await cardApi.updateCard(this.data.id, { status: "todo" });
      wx.showToast({ title: "已恢复", icon: "success" });
      this.loadCard();
    } catch (error) {
      this.showError(error);
    }
  },

  onDeleteTap() {
    wx.showModal({
      title: "删除卡片",
      content: "确定删除这张卡片吗？",
      confirmText: "删除",
      confirmColor: "#d92d20",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }

        try {
          await cardApi.deleteCard(this.data.id);
          wx.showToast({ title: "已删除", icon: "success" });
          setTimeout(() => wx.navigateBack(), 350);
        } catch (error) {
          this.showError(error);
        }
      },
    });
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
