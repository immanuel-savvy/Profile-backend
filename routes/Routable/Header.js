import { PROFILES, SESSIONS, TOKENS, USERS } from "../../ds/folders.js";
import { Mongo } from "@godprotocol/repositories";
import { post_request } from "../../utils/services.js";
import Services from "./Services.js";
import { decryptToken, encryptToken } from "../../handlers/v2/third_party.js";

class DB {
  constructor(db_name, config) {
    this.db = new Mongo({
      db_url: config.db_url,
      db_name: db_name.replace(/\./g, "-"),
    });

    this.folders = {};
  }

  folder = async (name) => {
    let folder = this.folders[name];

    if (folder) return folder;

    folder = this.db.collection(name);
    this.folders[name] = folder;

    return folder;
  };
}

class Headers extends Services {
  constructor() {
    super();
  }

  validate_api_key = async (api_key, authorization) => {
    let db = await this.platform_db(this.gp_uri);
    let cache = await db.folder("caches");
    let reslt = await cache.findOne({
      api_key: encryptToken(api_key, process.env.API_KEY),
      authorization,
      platform: process.env.PLATFORM_URI,
    });

    if (reslt)
      if (reslt.expiry && new Date(reslt.expiry) < new Date())
        await cache.deleteOne({ _id: reslt._id });
      else {
        let parsed;

        try {
          parsed = JSON.parse(decryptToken(reslt.payload, process.env.API_KEY));
        } catch (e) {
          parsed = null;
        }

        if (parsed) return { ok: true, data: parsed };
      }

    let headers = {
      "x-api-version": "v2",
      "x-api-key": api_key,
    };
    if (authorization) {
      headers["Authorization"] = `Bearer ${authorization}`;
    }
    let res = await post_request(`$PROFILE/validate`, {}, headers);

    if (res.ok) {
      await cache.updateOne(
        {
          api_key: encryptToken(api_key, process.env.API_KEY),
          authorization,
          platform: process.env.PLATFORM_URI,
        },
        {
          $set: {
            payload: encryptToken(
              JSON.stringify(res.data),
              process.env.API_KEY,
            ),
            expiry: res.data.expiry,
          },
          $setOnInsert: {
            _id: crypto.randomUUID(),
            created: new Date(),
            api_key: encryptToken(api_key, process.env.API_KEY),
            authorization,
            platform: process.env.PLATFORM_URI,
          },
        },
        {
          upsert: true,
        },
      );
    }

    return res;
  };

  validate_third_party = async (xplatform, authorization) => {
    let db = await this.platform_db(this.gp_uri);
    let cache = await db.folder("caches");
    let reslt = await cache.findOne({
      authorization,
      xplatform,
      platform: process.env.PLATFORM_URI,
    });

    if (reslt)
      if (reslt.expiry && new Date(reslt.expiry) < new Date())
        await cache.deleteOne({ _id: reslt._id });
      else {
        let parsed;

        try {
          parsed = JSON.parse(decryptToken(reslt.payload, process.env.API_KEY));
        } catch (e) {
          parsed = null;
        }

        if (parsed) return { ok: true, data: parsed };
      }

    let headers = {
      "x-api-version": "v2",
      "x-api-key": process.env.API_KEY,
    };
    if (authorization) {
      headers["Authorization"] = `Bearer ${authorization}`;
    }
    let res = await post_request(
      `$PROFILE/validate_third_party`,
      { platform_uri: xplatform },
      headers,
    );

    if (res.ok) {
      await cache.updateOne(
        {
          authorization,
          xplatform,
          platform: process.env.PLATFORM_URI,
        },
        {
          $set: {
            payload: encryptToken(
              JSON.stringify(res.data),
              process.env.API_KEY,
            ),
            expiry: res.data.expiry,
          },
          $setOnInsert: {
            _id: crypto.randomUUID(),
            created: new Date(),
            authorization,
            xplatform,
            platform: process.env.PLATFORM_URI,
          },
        },
        {
          upsert: true,
        },
      );
    }

    return res;
  };

  check_security = (requirements, payload) => {
    if (!requirements?.length) return true;

    let headers = payload.headers || {};

    let checks = {
      api_key: () => !!headers["x-api-key"],
      bearer_token: () => !!headers["authorization"],
      xplatform: () => !!headers["x-platform"],
    };

    return requirements.every((r) => checks[r]?.());
  };

  handle_security = async (name, request) => {
    let route = await this.get_route(name);

    if (!route.config.security?.length) return true;

    if (!this.check_security(route.config.security, request)) {
      console.log("Unauthorized access attempt to route:", name);
      return {
        ok: false,
        status: 401,
        message: "Unauthorized",
      };
    }

    let xplatform = request.headers["x-platform"],
      api_key = request.headers["x-api-key"],
      authorisation = request.headers["Authorization"];
    if (authorisation) authorisation = authorisation.replace("Bearer ", "");

    let val;
    if (xplatform) {
      val = await this.validate_third_party(xplatform, authorisation);
    } else {
      console.log(api_key, authorisation);
      val = await this.validate_api_key(api_key, authorisation);
      console.log(val, "Uhh");
    }

    console.log(val);
    if (!val?.ok) {
      return val;
    } else {
      val = val.data;
      if (!val) {
        return {
          ok: false,
          message: "malformed header validation",
          status: 403,
        };
      }
      request.headers.profile = val.profile;
      request.headers.xplatform = val.xplatform;
      request.headers.platform = val.platform;
    }

    return true;
  };
}

export default Headers;
export { DB };
