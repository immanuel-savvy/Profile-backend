import dotenv from "dotenv";
import GodProtocol from "godprotocol";

dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import path from "path";
import router from "./routes/index.js";
import services from "./services/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.static(`${__dirname}/assets`));
app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
app.use(bodyParser.json({ limit: "100mb" }));

app.get("/", async (req, res) => {
  res.send("Welcome to Profile API");
});

setTimeout(async () => {
  let gp = new GodProtocol({
    platform_uri: process.env.PLATFORM_URI,
    api_key: process.env.API_KEY,
    db_config: {
      db_url: process.env.MONGODB_URI,
    },
  });

  await router(gp);

  await gp.load_services(services);

  app.use((req, res) => gp.on_request(req, res));
}, 100);

export default app;
