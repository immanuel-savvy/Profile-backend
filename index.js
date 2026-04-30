import { OTPS, PROFILE_PASSWORDS, PROFILES, USERS } from "./ds/folders.js";
import handler from "./Profile.js";
import http from "http";
import { hash } from "./utils/hash.js";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  // let prof = {
  //   platform: "e9ffd470-972c-47f3-b0f5-595b6592fdf8",
  //   profile: "bbc10363-bcf6-409e-93d6-eef256c0c92c",
  //   phone: "+2349063813500",
  //   fristname: "NaptiQ",
  //   lastname: "Care",
  //   _id: crypto.randomUUID(),
  //   created: new Date(),
  // };
  // await (await PROFILES()).insertOne(prof);
  // await (
  //   await PROFILE_PASSWORDS()
  // ).insertOne({
  //   _id: prof._id,
  //   key: hash("Password123!"),
  // });

  console.log(`Profile API is listening on http://localhost:${port}`);
});
