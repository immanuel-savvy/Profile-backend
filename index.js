import { OTPS, PROFILES, USERS } from "./ds/folders.js";
import handler from "./Profile.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 4000;

server.listen(port, async () => {
  // await (await PROFILE_TYPES()).deleteOne({ _id: Platform_profile_type_id });

  // await boots();

  // await create_profiles();

  // console.log(await (await PROFILES()).findOne({ _id: "usr_settings_001" }));
  // await addjustment();

  // await email_setting_adjustment();

  let Users = await USERS();

  await (
    await PROFILES()
  ).updateOne(
    {
      _id: "731c32b9-5a89-449e-bc90-7b4fb740c618",
    },
    { $set: { platform: "usr_profile_001" } },
  );
  // await Users.deleteMany({ email: "immanuelsavvy@gmail.com" });

  // {
  //       "_id": ,
  //       "email": "isavvy@trimergecpa.com",
  //       "name": "Trimerge IQ",
  //       "created": "2026-04-05T11:13:58.164Z",
  //       "updated": "2026-04-05T11:13:58.164Z",
  //       "uri": "trimergeiq.trimergecpa.com"
  //   }
  // console.log(
  //   await (
  //     await SESSIONS()
  //   ).findOne({
  //     platform: "usr_email_001",
  //     platform_profile: "49b73c22-1e17-44d8-9d4b-40d08be21c2a",
  //     third_party_platform: "usr_profile_001",
  //   }),
  // );

  // console.log(
  //   await (
  //     await SESSIONS()
  //   ).findOne({
  //     platform: "usr_settings_001",
  //     platform_profile: "49b73c22-1e17-44d8-9d4b-40d08be21c2a",
  //     third_party_platform: "usr_profile_001",
  //   }),
  // );

  // console.log(
  //   await (await TOKENS()).findOne({ token: "token_value_email_001" }),
  // );
  // let Profiles = await PROFILES();

  // let otp = await OTPS("c59f98aa-0402-4bd4-ad9f-ab7e95180f14");

  // console.log(await otp.deleteMany());

  console.log(`Profile API is listening on http://localhost:${port}`);
});
