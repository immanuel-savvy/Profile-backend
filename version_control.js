import routerV1 from "./routes/routes-v1.js";
import routerV2 from "./routes/routes-v2.js";
import { default as services_config } from "./services/index.js";

const routers = {
  v1: routerV1,
  v2: routerV2,
};

const respond = async (result, res) => {
  let response = {
    ok: result?.ok,
    message: result.message,
    data: result.data,
  };
  if (result.pagination) response.pagination = result.pagination;
  if (result.token) response.token = result.token;

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

      let db = await router.resolve_db(req);

      try {
        result = await router.handle_security(name, req);

        if (result !== true) {
          return await respond(result, res);
        }
      } catch (err) {
        console.error(err);

        throw new Error("Security check failed");
      }

      // let services = await router.resolve_services(req, services_config);

      try {
        result = await router.execute(name, {
          body: req.body,
          headers: req.headers,
          db: db,
          // services: services,
        });

        await respond(result, res);
      } catch (err) {
        console.error(err);

        throw new Error("Route execution failed");
      }
    } catch (err) {
      console.error("Version Middleware Error:", err);

      return res.status(500).json({
        ok: false,
        message: "Internal server error",
      });
    }
  });
};

export default version_middleware;
