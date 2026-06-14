const { request } = require("../utils/request");

const wechatLogin = (code) =>
  request({
    path: "/auth/wechat-login",
    method: "POST",
    data: { code },
    showLoading: true,
  });

module.exports = {
  wechatLogin,
};
