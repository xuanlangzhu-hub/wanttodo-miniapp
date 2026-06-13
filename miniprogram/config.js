const baseUrls = {
  simulator: "http://localhost:5000/api/v1",
  device: "http://172.21.37.148:5000/api/v1",
};

const config = {
  activeEnv: "simulator",
  baseUrl: baseUrls.simulator,
  baseUrls,
};

module.exports = config;
