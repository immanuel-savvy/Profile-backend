import { PROFILES, SESSIONS, TOKENS, USERS } from "./ds/folders.js";
import routerV1 from "./routes/routes-v1.js";
import routerV2 from "./routes/routes-v2.js";

const routers = {
  v1: routerV1,
  v2: routerV2,
};

const version_middleware = (app) => {
  app.use(async (req, res) => {
    try {
      const version = req.headers["x-api-version"] || "v1";

      const router = routers[version];

      if (!router) {
        return res.status(400).json({
          error: "Invalid API version",
          version,
        });
      }

      let api_key = req.headers["x-api-key"];
      // console.log("API Key:", api_key);
      let authorisation = req.headers["authorization"];
      authorisation = authorisation
        ? authorisation.replace("Bearer ", "")
        : null;

      if (!api_key && !authorisation) {
        return res.status(403).json({
          error: "Forbidden",
        });
      }

      let ress;
      if (api_key) {
        let Tokens = await TOKENS();
        ress = await Tokens.findOne({ token: api_key });
        if (!ress)
          return res.status(403).json({
            error: "Invalid api keys",
          });

        let user = await (
          await USERS()
        ).findOne({
          _id: ress.user,
        });
        if (!user) {
          return res.status(403).json({
            error: "User not found for api key",
          });
        }

        req.headers.platform = user;
      }

      let xplatform = req.headers["x-platform"];
      if (!xplatform && authorisation) {
        let Tokens = await SESSIONS();

        ress = await Tokens.findOne({ token: authorisation });

        if (!ress)
          return res.status(403).json({
            error: "Invalid session token",
          });

        let Sessions = await SESSIONS();
        let session = await Sessions.findOne({
          // platform: { $exists: 0 },
          token: authorisation,
        });

        if (!session) {
          return res.status(403).json({
            error: "Invalid session token",
          });
        }

        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          await Sessions.deleteOne({ _id: session._id });

          return res.status(403).json({
            error: "Session expired",
          });
        }

        let user = await (
          session?.platform ? await PROFILES() : await USERS()
        ).findOne({
          _id: session.user,
        });

        if (!user) {
          return res.status(403).json({
            error: "User not found for session",
          });
        }

        req.headers.profile = user;
      }

      // Call the selected router
      return await router(req, res);
    } catch (err) {
      console.error("Version Middleware Error:", err);

      return res.status(500).json({
        error: "Internal server error",
      });
    }
  });
};

export default version_middleware;
