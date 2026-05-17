import routesv1 from "./routes-v1.js";
import routesv2 from "./routes-v2.js";
import routesv3 from "./routes-v3.js";

let router = async (gp) => {
  await gp.add_router("v1", routesv1, { is_old: true });
  await gp.add_router("v2", routesv2);
  await gp.add_router("v3", routesv3);
};

export default router;
