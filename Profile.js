import dotenv from "dotenv";
dotenv.config();

import GodProtocol from "godprotocol";

import router from "./routes/index.js";
import services from "./services/index.js";

let gp = new GodProtocol({
  platform_uri: process.env.PLATFORM_URI,
  api_key: process.env.API_KEY,
  db_config: {
    db_name: "v3-profiles",
    db_url: process.env.MONGODB_URI,
  },
});

await router(gp);

await gp.load_services(services);

// await gp.prior_callback(async (req) => {
//   let { headers } = req;
//   let { xplatform, platform, profile } = headers;

//   if (xplatform && xplatform.uri !== platform.uri) {
//     // third parties
//   } else {
//     // mine
//   }

//   return { ok: true };
// });

export default gp.on_request;
