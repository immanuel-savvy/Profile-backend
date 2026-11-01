const services_config = {
  identity: {
    local: "..",
    alias: ["identity"],
    uri: "profiles.savvyaisolution.com",
    api_key: process.env.API_KEY,
  },
  aimail: {
    url: process.env.DEV
      ? "http://localhost:4003"
      : "https://email-api.savvyaisolution.com",
    uri: "aimail.savvyaisolution.com",
    profile_key: process.env.AIMAIL_PROFILE_KEY,
  },
  settings: {
    uri: "settings.savvyaisolution.com",
    url: process.env.DEV
      ? "http://localhost:4005"
      : "https://settings-api.savvyaisolution.com",
    profile_key: process.env.SETTINGS_PROFILE_KEY,
  },
};

export default services_config;
