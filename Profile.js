import dotenv from "dotenv";
import GodProtocol from "godprotocol";

dotenv.config();

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

export default gp.on_request;
