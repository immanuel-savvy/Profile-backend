const services = () => {
  let DEV = process.env.DEV;

  return {
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

    //
    cache: {
      url: DEV ? "http://localhost:4014" : "https://cache1.rushbox.biz",
      uri: "cache.savvyaisolution.com",
      api_key: process.env.CACHE_PROFILE_KEY,
    },
  };
};

export default services;
