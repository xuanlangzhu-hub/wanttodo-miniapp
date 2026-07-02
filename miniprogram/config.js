const baseUrls = {
  simulator: "http://localhost:5000/api/v1",
  device: "http://你的局域网IP:5000/api/v1",
  production: "https://www.ccosia.cn/api/v1",
};

const activeEnv = "production";

const config = {
  activeEnv,
  baseUrl: baseUrls[activeEnv],
  baseUrls,
};

module.exports = config;
