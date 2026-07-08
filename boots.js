import { Mongo } from "@godprotocol/repositories";
import { Platform_profile_type_id } from "./handlers/v2/platform.js";
import { hash } from "./utils/hash.js";
import { PROFILE_PASSWORDS, PROFILES } from "./ds/folders.js";

let Profile_platform_id = "7ab29b3f-37c5-4957-b61f-d5d209aee8d8";
let Profile_profile_id = "01a84e70-2227-4865-95e1-71072b2badb3";

const boots = async () => {
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "v3-profiles",
  });

  // let Profiles = await db.collection("Profiles");
  // console.log(
  //   await Profiles.findOne({
  //     phone: "2348148253812",
  //     profile: "9ad3df92-6512-4641-ab01-52af6b5a4c96",
  //   }),
  // );

  // console.log(
  //   await (
  //     await db.collection("Profile_passwords")
  //   ).insertOne({
  //     profile: "f748c829-6451-4c3d-aa6e-f192ae1577a6",
  //     key: hash("rushbaby"),
  //     _id: crypto.randomUUID(),
  //     created: Date.now(),
  //   }),
  // );
  // let V1_profiles = await PROFILES();
  // let V1_passwords = await PROFILE_PASSWORDS();

  // let profiles_old = await V1_profiles.find({
  //   profile: "bbc10363-bcf6-409e-93d6-eef256c0c92c",
  // }).toArray();

  // let passwords_old = await V1_passwords.find({
  //   _id: { $in: profiles_old.map((p) => p._id) },
  // }).toArray();

  // await Passwords.insertMany(
  //   passwords_old.map((p) => {
  //     return {
  //       profile: p._id,
  //       _id: crypto.randomUUID(),
  //       key: p.key,
  //       created: Date.now(),
  //     };
  //   }),
  // );
  // console.log(passwords_old);

  return;
  let profiles = [
    {
      fullname: "Immanuel Savvy",
      email: "immanuelsavvy@gmail.com",
      profile: Platform_profile_type_id,
      platform: Profile_platform_id,
      created: Date.now(),
      _id: Profile_profile_id,
    },
    {
      fullname: "Immanuel Savvy",
      email: "immanuelsavvy@gmail.com",
      profile: "fb065baf-c20b-4e13-ad09-60ae040b442e",
      platform: "ad4c0eda-cd1a-4513-94bf-1df8d1539977",
      created: Date.now(),
      _id: "ab065baf-c20b-4e13-ad09-60ae040b44c",
    },
    {
      fullname: "Immanuel Savvy",
      email: "immanuelsavvy@gmail.com",
      profile: "206497e3-4f20-4ff0-aece-7ebdb6a86796",
      platform: "98af501d-13da-40f9-976f-3304b19d2c73",
      created: Date.now(),
      _id: "306497e3-4f20-4ff0-aece-7ebdb6a86797",
    },
  ];

  let Platforms = await db.collection("Platforms");

  let platforms = [
    {
      name: "Profile",
      profile: profiles[0]._id,
      uri: "profiles.savvyaisolution.com",
      created: Date.now(),
      _id: Profile_platform_id,
    },
  ];

  let ProfileTypes = await db.collection("Profile_types");

  let profile_types = [
    {
      name: "Platform",
      platform: platforms[0]._id,
      created: Date.now(),
      _id: Platform_profile_type_id,
      description: "Platform Profile Type",
    },
  ];

  let Tokens = await db.collection("Platform_tokens");
  let tokens = [
    {
      platform: platforms[0]._id,
      token: "platform_token",
      created: Date.now(),
      _id: "af626129-86e4-4239-b33d-560782a48245",
    },
  ];

  let passwords = [
    {
      profile: profiles[0]._id,
      key: hash("123456"),
      created: Date.now(),
      _id: "b1e426e0-3dc6-4d40-ab6e-0d6f3fa39035",
    },
    {
      profile: profiles[1]._id,
      key: hash("123456"),
      created: Date.now(),
      _id: "c1e426e0-3dc6-4d40-ab6e-0d6f3fa39036",
    },
    {
      profile: profiles[2]._id,
      key: hash("123456"),
      created: Date.now(),
      _id: "a1e426e0-3dc6-4d40-ab6e-0d6f3fa39034",
    },
  ];

  // await Profiles.insertMany(profiles.slice(1));
  // await Passwords.insertMany(passwords.slice(1));
  // await ProfileTypes.insertMany(profile_types);
  // await Tokens.insertMany(tokens);
  // await Platforms.insertMany(platforms);
  console.log("Bootstrapped database with initial data");
};

export { boots, Profile_platform_id, Profile_profile_id };
