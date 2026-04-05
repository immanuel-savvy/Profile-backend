import { boots, create_profiles } from "./boots.js";
import {
  PROFILE_TYPES,
  PROFILES,
  SESSIONS,
  TOKENS,
  USERS,
} from "./ds/folders.js";
import { Platform_profile_type_id } from "./handlers/v2/platform.js";
import handler from "./Profile.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  // await (await PROFILE_TYPES()).deleteOne({ _id: Platform_profile_type_id });

  await boots();

  await create_profiles();

  let Users = await USERS();
  // await Users.deleteMany({ email: "immanuelsavvy@gmail.com" });

  console.log(
    await (await TOKENS()).findOne({ token: "token_value_email_001" }),
  );
  // let Profiles = await PROFILES();

  console.log(`Profile API is listening on http://localhost:${port}`);
});
