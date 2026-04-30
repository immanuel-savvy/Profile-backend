import Route_table from "./Routable/Route_table.js";
import routesv1 from "./routes-v1.js";
import routesv2 from "./routes-v2.js";

let router = async () => {
  console.log(process.env.API_KEY);
  let routeable;

  routeable = new Route_table();
  await routeable.init_version("v1", { is_old: true });
  routeable.versions["v1"].routes = routesv1;

  await routeable.init_version("v2");
  await routeable.load_routes(routesv2);

  setTimeout(() => {
    routeable.db_config = {
      db_url: process.env.MONGODB_URI,
    };
  }, 100);

  return routeable;
};

export default await router();
