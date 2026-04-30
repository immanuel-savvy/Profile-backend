import { decryptToken, encryptToken } from "../../handlers/v2/third_party.js";
import services from "../../services/index.js";
import { post_request } from "../../utils/services.js";
import { DB } from "./Header.js";

class Services {
  constructor() {
    this.gp_uri = "godprotocol.savvyaisolution.com";
    this.cache_duration = 7 * 24 * 60 * 60 * 1000;

    this.load_services(services);
  }

  load_services = async (services) => {};

  platform_db = async (uri) => {
    return new DB(
      uri || process.env.DB_NAME || process.env.PLATFORM_URI,
      this.db_config,
    );
  };

  resolve_db = async (req) => {
    let { platform } = req.headers;
    if (req.headers["x-api-key"] === process.env.API_KEY) {
      let db = await this.platform_db();

      req.db = db;

      return db;
    }

    let db = await this.platform_db(this.gp_uri);
    let cache = await db.folder(`caches`);
    let config = await cache.findOne({
      category: "db",
      key: platform?.uri,
      platform: process.env.PLATFORM_URI,
    });

    if (config)
      if (
        new Date(config.updated).getTime() + this.cache_duration <
        new Date()
      ) {
        config = null;
      } else {
        config = decryptToken(config.config, process.env.API_KEY);
      }

    if (!config) {
      let res = await post_request(`$PROFILE/get_token`, {
        platform: platform._id,
        platform_uri: "settings.savvyaisolution.com",
      });

      if (!res.ok) {
        return {
          ok: false,
          message: "Invalid API key or platform",
        };
      }

      let token = res.token;

      if (!token) {
        return {
          ok: false,
          message: "No token found for this platform",
        };
      }

      let decrypted_token = decryptToken(token, process.env.API_KEY); // Implement decryption if necessary

      if (!decrypted_token) {
        return {
          ok: false,
          message: "Failed to decrypt token",
        };
      }

      let db_res = await post_request("$SETTINGS/get_settings", {
        category: "db",
        key: [process.env.PLATFORM_URI, "general"],
      });

      if (!db_res.ok) {
        return {
          ok: false,
          message: "Failed to retrieve database configuration",
        };
      }

      config =
        db_res.data?.db?.[`${process.env.PLATFORM_URI}`] ||
        db_res.data?.db?.["general"];

      if (!config) {
        return {
          ok: false,
          message: "Database configuration not found",
        };
      }

      const now = new Date();

      await cache.updateOne(
        {
          category: "db",
          key: platform.uri,
          platform: process.env.PLATFORM_URI,
        },
        {
          $set: {
            config: encryptToken(JSON.stringify(config), process.env.API_KEY),
            updated: now,
          },
          $setOnInsert: {
            _id: crypto.randomUUID(),
            created: now,
            category: "db",
            key: platform.uri,
            platform: process.env.PLATFORM_URI,
          },
        },
        {
          upsert: true,
        },
      );
    }

    db = new DB(process.env.PLATFORM_URI, config);

    req.db = db;

    return true;
  };

  resolve_services = async (req, route_config) => {
    if (!route_config?.security?.length && !route_config.no_db) {
      let db = await this.platform_db();
      req.db = db;
    } else {
      let res = route_config?.no_db || (await this.resolve_db(req));
      if (res !== true) return res;
    }

    return {
      db: req.db,
      services: {
        call: this.get_service,
      },
    };
  };
}

export default Services;
