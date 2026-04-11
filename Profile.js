import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import path from "path";

import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import version_middleware from "./version_control.js";

const app = express();
app.use(cors());
app.use(express.static(`${__dirname}/assets`));
app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
app.use(bodyParser.json({ limit: "100mb" }));

app.get("/", async (req, res) => {
  res.send("Welcome to Profile API");
});

version_middleware(app);

export default app;
