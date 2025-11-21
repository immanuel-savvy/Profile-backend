import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import path from "path";

import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import router from "./routes.js";
import { PASSWORDS, PROFILE_TYPES, USERS } from "./ds/folders.js";
import { PROFILE_ID } from "./handlers/auth.js";

const app = express();

app.use(cors());
app.use(express.static(`${__dirname}/assets`));
app.use(bodyParser.urlencoded({ extended: true, limit: "100mb" }));
app.use(bodyParser.json({ limit: "100mb" }));

app.get("/", async (req, res) => {
  let Users = await USERS();
  if (!(await Users.findOne({ _id: PROFILE_ID }))) {
    await Users.insertOne({
      _id: PROFILE_ID,
      email: "profile@savvyaisolution.com",
      firstname: "Profile",
      lastname: "",
      verified: true,
    });

    await (
      await PROFILE_TYPES(PROFILE_ID)
    ).insertOne({
      name: "Profile",
      type: "default",
    });

    let Passwords = await PASSWORDS();
    await Passwords.insertOne({
      _id: PROFILE_ID,
      password: hash(process.env.PROFILE_PASSWORD),
    });
  }

  res.send("Welcome to Profile API");
});

router(app);

export default app;
