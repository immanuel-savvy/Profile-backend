let DEV = false && !process.env.DEV;

const services = {
  settings: {
    url: DEV
      ? "http://localhost:4005"
      : "https://settings-api.savvyaisolution.com",
    api_version: "v1",
    uri: "settings.savvyaisolution.com",
  },
  aimail: {
    url: DEV
      ? "http://localhost:4003"
      : "https://email-api.savvyaisolution.com",
    uri: "aimail.savvyaisolution.com",
    api_version: "v3",
  },
};

export default services;
