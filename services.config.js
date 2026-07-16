const services_config = {
  identity: {
    local: "..",
    alias: ["identity"],
    uri: "profiles.savvyaisolution.com",
    api_key: process.env.API_KEY,
  },
  aimail: {
    uri: "aimail.savvyaisolution.com",
    url: process.env.DEV
      ? "http://localhost:4003"
      : "https://email-api.savvyaisolution.com",
  },
  settings: {
    uri: "settings.savvyaisolution.com",
    url: process.env.DEV
      ? "http://localhost:4005"
      : "https://settings-api.savvyaisolution.com",
  },
};

const gp_services_config = {
  identity: {
    local: "identity",
    uri: "profiles.savvyaisolution.com",
    api_key: process.env.API_KEY,
  },
};

export default services_config;
export { gp_services_config };
