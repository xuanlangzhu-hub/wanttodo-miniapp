const baseUrls = {
  simulator: "http://localhost:5000/api/v1",
  device: "http://你的局域网IP:5000/api/v1",
  production: "https://你的域名/api/v1",
};

const activeEnv = "simulator";

const config = {
  activeEnv,
  baseUrl: baseUrls[activeEnv],
  baseUrls,
};

module.exports = config;
