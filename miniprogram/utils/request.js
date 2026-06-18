const getAppSafe = () => {
  try {
    return getApp();
  } catch (error) {
    return null;
  }
};

const buildUrl = (path, query) => {
  const app = getAppSafe();
  const baseUrl = app && app.globalData && app.globalData.baseUrl
    ? app.globalData.baseUrl
    : "http://localhost:5000/api/v1";
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryEntries = Object.keys(query || {}).filter((key) => {
    const value = query[key];
    return value !== undefined && value !== null && value !== "";
  });

  if (!queryEntries.length) {
    return `${baseUrl}${normalizedPath}`;
  }

  const queryString = queryEntries
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join("&");

  return `${baseUrl}${normalizedPath}?${queryString}`;
};

const DEFAULT_TIMEOUT = 15000;

const request = ({ path, method = "GET", data, query, showLoading = false, timeout = DEFAULT_TIMEOUT }) => {
  const app = getAppSafe();
  const token = app && app.globalData && app.globalData.token
    ? app.globalData.token
    : wx.getStorageSync("token") || "";

  if (showLoading) {
    wx.showLoading({ title: "加载中" });
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(path, query),
      method,
      data,
      timeout,
      header: token
        ? {
            "content-type": "application/json; charset=utf-8",
            Authorization: `Bearer ${token}`,
          }
        : {
            "content-type": "application/json; charset=utf-8",
          },
      success(response) {
        const body = response.data || {};
        const ok = response.statusCode >= 200 && response.statusCode < 300;

        const apiOk = body.code === undefined || body.code < 400;

        if (ok && apiOk) {
          resolve(Object.prototype.hasOwnProperty.call(body, "data") ? body.data : body);
          return;
        }

        const message = body.message || `请求失败：${response.statusCode}`;
        reject({
          statusCode: response.statusCode,
          code: body.code || response.statusCode,
          message,
          data: body.data || null,
        });
      },
      fail(error) {
        reject({
          statusCode: 0,
          code: 0,
          message: error.errMsg || "网络请求失败",
          data: null,
        });
      },
      complete() {
        if (showLoading) {
          wx.hideLoading();
        }
      },
    });
  });
};

module.exports = {
  request,
};
