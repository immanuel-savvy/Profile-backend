import dotenv from "dotenv";
dotenv.config();

import GodProtocol from "godprotocol";
import identity from "@web4.0/identity";

import services_config, { gp_services_config } from "./services.config.js";

console.log(services_config);
let gp = new GodProtocol({
  platform_uri: process.env.PLATFORM_URI,
  api_key: process.env.API_KEY,
  db_config: {
    db_name: "v3-profiles",
    db_url: process.env.MONGODB_URI,
  },
  server: {
    domain: process.env.DEV
      ? "http://localhost:4000"
      : "https://profile-api.savvyaisolution.com",
  },
  capabilities: gp_services_config,
});

await identity.router(gp, { services_config });

gp.on_start((gp) => {
  // identity.boot(gp, { services_config });
  console.log(Object.keys(gp.route_table.versions));
});

gp.boot();

export default gp.on_request;
