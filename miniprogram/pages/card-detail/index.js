const cardApi = require("../../services/cards");

const STATUS_TEXT = {
  todo: "待整理",
  done: "已整理",
  archived: "已归档",
};

const COPY_HOLD_MS = 2000;
const TOUCH_MOVE_CANCEL_DISTANCE = 12;

Page({
  copyTimer: null,
  copyTriggered: false,
  touchStartPoint: null,

  data: {
    id: "",
    card: null,
    loading: false,
    loggedIn: false,
    copyHolding: false,
    statusText: "",
    navTop: 0,
    navHeight: 44,
    contentTop: 92,
  },

  onLoad(options = {}) {
    this.setNavMetrics();
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

  onUnload() {
    this.clearCopyTimer();
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

  async loadCard() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    this.setData({ loading: true });
    try {
      const card = await cardApi.getCard(this.data.id);
      const formattedCard = this.formatCard(card);

      this.setData({
        card: formattedCard,
        statusText: STATUS_TEXT[formattedCard.status] || formattedCard.status || "",
      });
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  formatCard(card = {}) {
    return Object.assign({}, card, {
      bodyText: card.sourceText || card.content || "",
      createdAtText: this.formatTime(card.createdAt),
      updatedAtText: this.formatTime(card.updatedAt),
    });
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.switchTab({ url: "/pages/content-pool/index" });
  },

  onEditTap() {
    if (!this.ensureLoggedIn()) {
      return;
    }

    wx.navigateTo({
      url: `/pages/card-form/index?id=${this.data.id}`,
    });
  },

  onReaderTouchStart(event) {
    if (!this.data.card) {
      return;
    }

    const touch = event.touches && event.touches[0];
    this.copyTriggered = false;
    this.touchStartPoint = touch ? { x: touch.clientX, y: touch.clientY } : null;
    this.clearCopyTimer();
    this.setData({ copyHolding: true });
    this.copyTimer = setTimeout(() => {
      this.copyTimer = null;
      this.copyTriggered = true;
      this.setData({ copyHolding: false });
      this.copyContent();
    }, COPY_HOLD_MS);
  },

  onReaderTouchMove(event) {
    if (!this.touchStartPoint || !this.copyTimer) {
      return;
    }

    const touch = event.touches && event.touches[0];
    if (!touch) {
      return;
    }

    const distanceX = Math.abs(touch.clientX - this.touchStartPoint.x);
    const distanceY = Math.abs(touch.clientY - this.touchStartPoint.y);
    if (distanceX > TOUCH_MOVE_CANCEL_DISTANCE || distanceY > TOUCH_MOVE_CANCEL_DISTANCE) {
      this.clearCopyTimer();
    }
  },

  onReaderTouchEnd() {
    if (!this.copyTriggered) {
      this.clearCopyTimer();
    }
    this.touchStartPoint = null;
  },

  onReaderTouchCancel() {
    this.clearCopyTimer();
    this.touchStartPoint = null;
  },

  clearCopyTimer() {
    if (this.copyTimer) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
    if (this.data.copyHolding) {
      this.setData({ copyHolding: false });
    }
  },

  copyContent() {
    if (!this.data.card) {
      return;
    }

    wx.setClipboardData({
      data: this.buildCopyText(this.data.card),
      success: () => {
        wx.showToast({ title: "已复制卡片内容", icon: "success" });
      },
    });
  },

  buildCopyText(card) {
    const lines = [
      card.title || "",
      card.summary || card.bodyText || "",
    ];

    if (card.summary && card.bodyText) {
      lines.push(card.bodyText);
    }

    if (card.tags && card.tags.length) {
      lines.push(`标签：${card.tags.map((tag) => `#${tag}`).join(" ")}`);
    }

    if (card.sourceUrl) {
      lines.push(`来源链接：${card.sourceUrl}`);
    }

    return lines.filter(Boolean).join("\n\n");
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
