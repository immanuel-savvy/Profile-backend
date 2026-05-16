import handler from "./Profile.js";
import http from "http";
import { createVerification } from "./services/email.js";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  console.log(`Profile API is listening on http://localhost:${port}`);
});
