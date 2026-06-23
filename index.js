import { boots } from "./boots.js";
import handler from "./Profile.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  boots();
  console.log(`Profile API is listening on http://localhost:${port}`);
});
