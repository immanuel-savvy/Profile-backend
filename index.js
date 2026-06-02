import handler from "./Profile.js";
import http from "http";

import { boots } from "./boots.js";
import { createVerification } from "./services/email.js";
import { checkVerification } from "./handlers/v1/profile.js";
import { USERS } from "./ds/folders.js";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  // console.log(await createVerification("+2347064704080"));
  // console.log(await checkVerification("9829", "+2347064704080"));
  // console.log(crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID());
  // await boots();

  console.log(`Profile API is listening on http://localhost:${port}`);
});
