let DEV = !process.env.PROD;

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
      ? "http://localhost:4002"
      : "https://email-api.savvyaisolution.com",
    uri: "aimail.savvyaisolution.com",
    api_version: "v2",
  },
};

export default services;
