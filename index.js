import handler from "./Profile.js";
import http from "http";
import { createVerification } from "./services/email.js";
import { checkVerification } from "./handlers/v1/profile.js";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  // console.log(await createVerification("+2347064704080"));
  // console.log(await checkVerification("1944", "+2347064704080"));
  console.log(`Profile API is listening on http://localhost:${port}`);
});
