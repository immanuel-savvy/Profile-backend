let DEV = true;

let Services = {
  profile: {
    url: DEV
      ? "http://localhost:4000"
      : "https://profile-api.savvyaisolution.com",
    "x-api-version": "v2",
  },
  settings: {
    url: DEV
      ? "http://localhost:4005"
      : "https://settings-api.savvyaisolution.com",
    "x-api-version": "v1",
  },
};

const BACKEND = DEV
  ? "http://localhost:8005"
  : "https://trimerge-iq-backend.vercel.app";

const post_request = async (url, body, header) => {
  let ftch;
  try {
    if (!url.startsWith("$")) {
      url = `${BACKEND}/${url}`;

      let headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (header) {
        headers = { ...headers, ...header };
      }

      ftch = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } else {
      let service = url.split("/");
      let name = service[0].slice(1).toLowerCase();

      let service_conf = Services[name];

      url = `${service_conf.url}/${service.slice(1).join("/")}`;

      let headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-version": service_conf["x-api-version"],
      };
      if (header) {
        headers = { ...headers, ...header };
      }

      ftch = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }

    let res = await ftch.json();

    return res;
  } catch (e) {
    return { ok: false, message: "Network error." };
  }
};

export { post_request };
