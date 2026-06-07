import handler from "./Profile.js";
import http from "http";

import { boots } from "./boots.js";
import { createVerification } from "./services/email.js";
import { checkVerification } from "./handlers/v1/profile.js";
import { PROFILES, USERS } from "./ds/folders.js";
import { hash } from "./utils/hash.js";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  // console.log(await createVerification("+2347064704080"));
  // console.log(await checkVerification("9829", "+2347064704080"));
  // console.log(crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID());
  // await boots();

  console.log(hash("lolagrey"));

  // console.log(
  //   JSON.stringify(
  //     await (await PROFILES()).findOne({ phone: "2347064704080" }),
  //     null,
  //     2,
  //   ),
  // );

  console.log(`Profile API is listening on http://localhost:${port}`);
});
