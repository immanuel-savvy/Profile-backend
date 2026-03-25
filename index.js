import { PROFILES } from "./ds/folders.js";
import handler from "./Profile.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  // console.log(
  //   await (
  //     await PROFILES()
  //   ).deleteMany({
  //     profile: "bbc10363-bcf6-409e-93d6-eef256c0c92c",
  //     phone: "+2349074991739",
  //   }),
  // );
  console.log(`Profile API is listening on http://localhost:${port}`);
});
