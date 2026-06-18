const baseUrls = {
  simulator: "http://localhost:5000/api/v1",
  device: "http://192.168.236.6:5000/api/v1",
  production: "https://your-domain.example/api/v1",
};

const activeEnv = "simulator";

const config = {
  activeEnv,
  baseUrl: baseUrls[activeEnv],
  baseUrls,
};

module.exports = config;
