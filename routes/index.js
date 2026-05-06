import routesv1 from "./routes-v1.js";
import routesv2 from "./routes-v2.js";

let router = async (gp) => {
  console.log(process.env.API_KEY);

  await gp.add_router("v1", routesv1, { is_old: true });
  await gp.add_router("v2", routesv2);

  // await gp.route_table.get_route("new_platform");
};

export default router;
