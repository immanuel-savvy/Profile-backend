import { PROFILES, SESSIONS, TOKENS, USERS } from "./ds/folders.js";
import routerV1 from "./routes/routes-v1.js";
import routerV2 from "./routes/routes-v2.js";

const routers = {
  v1: routerV1,
  v2: routerV2,
};

const respond = async (result, res) => {
  let response = {
    ok: result.ok,
    message: result.message,
    data: result.data,
  };
  if (result.pagination) response.pagination = result.pagination;

  res.status(result?.status || (result?.ok ? 200 : 403)).json(response);
};

const version_middleware = (app) => {
  app.use(async (req, res) => {
    try {
      const version = req.headers["x-api-version"] || "v1";

      const router = routers[version];

      if (version === "v1") return router(req, res);

      if (!router) {
        return res.status(400).json({
          error: "Invalid API version",
          version,
        });
      }

      let name = req.path.slice(1),
        result;

      try {
        result = await router.handle_security(name, req);

        await respond(result, res);
      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          message: "Internal Server Error",
        });
      }

      try {
        result = await router.execute(name, {
          body: req.body,
          headers: req.headers,
        });

        await respond(result, res);
      } catch (err) {
        console.error(err);

        res.status(500).json({
          ok: false,
          message: "Internal Server Error",
        });
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
