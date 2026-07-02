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
    saving: false,
    organizeRemaining: 2,
    dailyRemaining: 10,
    cardQuotaRemaining: 100,
    dailyResetAt: "",
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
    this.loadQuota();
  },

  onShow() {
    if (this.data.loggedIn) {
      this.loadQuota();
    }
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

    wx.switchTab({ url: "/pages/index/index" });
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
        organizeRemaining: Number.isFinite(card.organizeRemaining) ? card.organizeRemaining : 2,
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

    if (this.data.organizeRemaining <= 0) {
      wx.showToast({ title: "本卡整理次数已用完", icon: "none" });
      return;
    }

    if (this.data.dailyRemaining <= 0) {
      await this.loadQuota();
      if (this.data.dailyRemaining <= 0) {
        wx.showToast({ title: "今日整理次数已用完", icon: "none" });
        return;
      }
    }

    const sourceText = this.data.form.sourceText.trim();
    if (!sourceText) {
      wx.showToast({ title: "请先填写内容", icon: "none" });
      return;
    }

    this.setData({ organizing: true });
    try {
      const cardId = await this.ensureCardForOrganize();
      const result = await cardApi.organizeCard(cardId, {
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
        organizeRemaining: Number.isFinite(result.organizeRemaining)
          ? result.organizeRemaining
          : Math.max(0, this.data.organizeRemaining - 1),
        dailyRemaining: Number.isFinite(result.dailyRemaining)
          ? result.dailyRemaining
          : Math.max(0, this.data.dailyRemaining - 1),
        dailyResetAt: result.dailyResetAt || this.data.dailyResetAt,
      });
      wx.showToast({ title: "已生成整理建议", icon: "success" });
    } catch (error) {
      if (!error.silent) {
        await this.refreshUsageQuota();
        this.showError(error);
      }
    } finally {
      this.setData({ organizing: false });
    }
  },

  async onSaveTap() {
    if (this.data.saving) {
      return;
    }

    if (!this.ensureLoggedIn()) {
      return;
    }

    if (this.data.mode === "create" && this.data.cardQuotaRemaining <= 0) {
      wx.showToast({ title: "已达100张创建上限", icon: "none" });
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

    this.setData({ saving: true });
    try {
      let card;
      if (this.data.mode === "edit") {
        card = await cardApi.updateCard(this.data.id, payload);
      } else {
        card = await cardApi.createCard(payload);
      }

      const targetId = (card && card.id) || this.data.id;
      if (!targetId) {
        wx.showToast({ title: "已保存，请返回列表查看", icon: "none" });
        return;
      }

      wx.showToast({ title: "已保存", icon: "success" });
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/card-detail/index?id=${targetId}`,
        });
      }, 350);
    } catch (error) {
      this.showError(error);
    } finally {
      this.setData({ saving: false });
    }
  },

  async ensureCardForOrganize() {
    if (this.data.id) {
      return this.data.id;
    }

    if (this.data.cardQuotaRemaining <= 0) {
      throw { message: "累计创建卡片已达100张上限" };
    }

    const confirmed = await this.confirmDraftCreation();
    if (!confirmed) {
      throw { silent: true };
    }

    const form = this.data.form;
    const draftTitle = form.title.trim() || "待整理卡片";
    const card = await cardApi.createCard({
      title: draftTitle,
      sourceText: form.sourceText.trim(),
      summary: form.summary.trim(),
      sourceUrl: form.sourceUrl.trim(),
      tags: splitTags(form.tagsText),
      status: form.status,
    });

    if (!card || !card.id) {
      throw { message: "创建卡片失败，请稍后重试" };
    }

    this.setData({
      id: card.id,
      mode: "edit",
      "form.title": draftTitle,
      cardQuotaRemaining: Math.max(0, this.data.cardQuotaRemaining - 1),
      organizeRemaining: Number.isFinite(card.organizeRemaining) ? card.organizeRemaining : 2,
    });
    wx.setNavigationBarTitle({ title: "编辑卡片" });
    return card.id;
  },

  confirmDraftCreation() {
    return new Promise((resolve) => {
      wx.showModal({
        title: "创建并智能整理",
        content: "首次整理会自动创建这张卡片，并计入100张终身创建额度；删除后额度也不会恢复。",
        confirmText: "继续整理",
        confirmColor: "#ff7966",
        success: (result) => resolve(Boolean(result.confirm)),
        fail: () => resolve(false),
      });
    });
  },

  async loadQuota() {
    if (!this.ensureLoggedIn(false)) {
      return;
    }

    try {
      const quota = await cardApi.getQuota();
      const cardQuota = quota.cardQuota || {};
      const aiQuota = quota.aiQuota || {};
      this.setData({
        cardQuotaRemaining: Number.isFinite(cardQuota.remaining) ? cardQuota.remaining : 100,
        dailyRemaining: Number.isFinite(aiQuota.remainingToday) ? aiQuota.remainingToday : 10,
        dailyResetAt: aiQuota.resetAt || "",
      });
    } catch (error) {
      // 后端仍会执行最终额度校验。
    }
  },

  async refreshUsageQuota() {
    await this.loadQuota();
    if (!this.data.id) {
      return;
    }

    try {
      const card = await cardApi.getCard(this.data.id);
      if (Number.isFinite(card.organizeRemaining)) {
        this.setData({ organizeRemaining: card.organizeRemaining });
      }
    } catch (error) {
      // 保留当前页面内容，由后端继续执行最终额度校验。
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
