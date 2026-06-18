Page({
  data: {
    updatedAt: "2026-06-18",
  },

  onBackTap() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.switchTab({ url: "/pages/profile/index" });
  },
});
