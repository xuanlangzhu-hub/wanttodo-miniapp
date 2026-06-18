const ROUTES = {
  home: "/pages/index/index",
  pool: "/pages/content-pool/index",
  pending: "/pages/pending/index",
  me: "/pages/profile/index",
};

Component({
  properties: {
    active: {
      type: String,
      value: "home",
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

    onCreateTap() {
      wx.navigateTo({
        url: "/pages/card-form/index",
      });
    },
  },
});
