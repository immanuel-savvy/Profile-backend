import routers from "./routes/index.js";

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

      let router = routers.get_version(version);

      console.log(router);
      if (router.config?.is_old) return router.routes(req, res);

      if (!router) {
        return res.status(400).json({
          error: "Invalid API version",
          version,
        });
      }

      router = routers;

      let name = req.path.slice(1),
        result;

      try {
        result = await router.handle_security(name, req);
        console.log(result, "UHH");

        if (result !== true) {
          return await respond(result, res);
        }
      } catch (err) {
        console.error(err);

        throw new Error("Security check failed");
      }

      let services = await router.resolve_services(
        req,
        await router.get_route_config(name),
      );

      try {
        result = await router.execute(name, {
          body: req.body,
          headers: req.headers,
          db: services?.db,
          services: services,
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
