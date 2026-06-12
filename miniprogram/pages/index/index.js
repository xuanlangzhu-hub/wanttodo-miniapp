const todoApi = require("../../services/todos");
const authApi = require("../../services/auth");

const STATUS_TABS = [
  { label: "全部", value: "all" },
  { label: "进行中", value: "active" },
  { label: "已完成", value: "completed" },
];

const wxLogin = () =>
  new Promise((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    });
  });

Page({
  data: {
    statusTabs: STATUS_TABS,
    status: "all",
    todos: [],
    total: 0,
    page: 1,
    pageSize: 20,
    newTitle: "",
    loading: false,
    loggedIn: false,
    userInfo: null,
    avatarText: "我",
  },

  onLoad() {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    this.setData({
      loggedIn: Boolean(app.globalData.token),
      userInfo,
      avatarText: this.getAvatarText(userInfo),
    });

    if (app.globalData.token) {
      this.loadTodos(true);
    }
  },

  onPullDownRefresh() {
    this.loadTodos(true).finally(() => wx.stopPullDownRefresh());
  },

  async onLoginTap() {
    try {
      const loginResult = await wxLogin();
      if (!loginResult.code) {
        throw new Error("微信登录失败");
      }

      const authData = await authApi.wechatLogin(loginResult.code);
      getApp().setAuth(authData.token, authData.userInfo);
      this.setData({
        loggedIn: true,
        userInfo: authData.userInfo,
        avatarText: this.getAvatarText(authData.userInfo),
      });
      wx.showToast({ title: "登录成功", icon: "success" });
      this.loadTodos(true);
    } catch (error) {
      this.showError(error);
    }
  },

  onInputTitle(event) {
    this.setData({
      newTitle: event.detail.value,
    });
  },

  async onAddTodo() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }

    const title = this.data.newTitle.trim();
    if (!title) {
      wx.showToast({ title: "先写一个待办", icon: "none" });
      return;
    }

    try {
      await todoApi.createTodo({
        title,
        description: "",
        priority: 2,
        dueDate: null,
      });
      this.setData({ newTitle: "" });
      wx.showToast({ title: "已添加", icon: "success" });
      this.loadTodos(true);
    } catch (error) {
      this.showError(error);
    }
  },

  async onToggleTodo(event) {
    const { id, completed } = event.currentTarget.dataset;
    try {
      await todoApi.updateTodo(id, {
        completed: !completed,
      });
      this.loadTodos(true);
    } catch (error) {
      this.showError(error);
    }
  },

  onDeleteTodo(event) {
    const { id } = event.currentTarget.dataset;
    wx.showModal({
      title: "删除待办",
      content: "确定删除这条待办吗？",
      confirmText: "删除",
      confirmColor: "#d92d20",
      success: async (result) => {
        if (!result.confirm) {
          return;
        }

        try {
          await todoApi.deleteTodo(id);
          wx.showToast({ title: "已删除", icon: "success" });
          this.loadTodos(true);
        } catch (error) {
          this.showError(error);
        }
      },
    });
  },

  onTabTap(event) {
    const status = event.currentTarget.dataset.status;
    if (status === this.data.status) {
      return;
    }

    this.setData({ status, page: 1 });
    this.loadTodos(true);
  },

  async loadTodos(showLoading = false) {
    this.setData({ loading: true });
    try {
      const data = await todoApi.getTodos({
        page: 1,
        pageSize: this.data.pageSize,
        status: this.data.status,
        sort: "createdAt",
        order: "desc",
        showLoading,
      });

      this.setData({
        todos: data.list || [],
        total: data.total || 0,
        page: data.page || 1,
        pageSize: data.pageSize || this.data.pageSize,
      });
    } catch (error) {
      if (error.statusCode === 401) {
        getApp().clearAuth();
        this.setData({
          loggedIn: false,
          userInfo: null,
          todos: [],
          total: 0,
        });
      }
      this.showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  showError(error) {
    wx.showToast({
      title: error.message || "操作失败",
      icon: "none",
    });
  },

  getAvatarText(userInfo) {
    const nickname = userInfo && userInfo.nickname ? userInfo.nickname : "";
    return nickname ? nickname.slice(0, 1) : "我";
  },
});
