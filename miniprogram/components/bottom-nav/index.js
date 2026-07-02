const ROUTES = {
  home: "/pages/index/index",
  pool: "/pages/content-pool/index",
  pending: "/pages/pending/index",
  me: "/pages/profile/index",
};

const cardApi = require("../../services/cards");

Component({
  properties: {
    active: {
      type: String,
      value: "home",
    },
  },

  data: {
    cardLimitReached: false,
  },

  lifetimes: {
    attached() {
      this.refreshQuota();
    },
  },

  pageLifetimes: {
    show() {
      this.refreshQuota();
    },
  },

  methods: {
    onNavTap(event) {
      const key = event.currentTarget.dataset.key;
      const url = ROUTES[key];
      if (!url || key === this.properties.active) {
        return;
      }

      wx.switchTab({ url });
    },

    async onCreateTap() {
      const app = getApp();
      if (!app.globalData.token) {
        wx.showToast({ title: "请先登录", icon: "none" });
        return;
      }

      await this.refreshQuota();
      if (this.data.cardLimitReached) {
        wx.showToast({ title: "累计创建卡片已达100张上限", icon: "none" });
        return;
      }

      wx.navigateTo({
        url: "/pages/card-form/index",
      });
    },

    async refreshQuota() {
      const app = getApp();
      if (!app.globalData.token) {
        this.setData({ cardLimitReached: false });
        return;
      }

      try {
        const quota = await cardApi.getQuota();
        this.setData({
          cardLimitReached: Boolean(quota.cardQuota && quota.cardQuota.reached),
        });
      } catch (error) {
        // 创建接口仍会执行最终额度校验。
      }
    },
  },
});
