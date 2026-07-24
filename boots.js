import { MongoClient } from "mongodb";
import { Mongo } from "@godprotocol/repositories";
import crypto from "crypto";

const hash = (password, alg = "sha256") => {
  return crypto.createHash(alg).update(password).digest("hex");
};

const boots = async () => {
  // let db = new Mongo({
  //   db_url: process.env.MONGODB_URI,
  //   db_name: "v3-profiles",
  // });

  // let Profiles = await db.collection("Profile_passwords");
  // console.log(
  //   await Profiles.insertOne({
  //     key: hash("123456"),
  //     _id: crypto.randomUUID(),
  //     created: Date.now(),
  //     profile: "afd86bb6-8261-4b8a-88ba-ada35757250a",
  //   }),
  // );

  return;

  // console.log(
  //   await (
  //     await db.collection("Profile_passwords")
  //   ).deleteOne({
  //     profile: "f748c829-6451-4c3d-aa6e-f192ae1577a6",
  //     // key: hash("rushbaby"),
  //     // _id: crypto.randomUUID(),
  //     // created: Date.now(),
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
  // let profiles = [
  //   {
  //     fullname: "Immanuel Savvy",
  //     email: "immanuelsavvy@gmail.com",
  //     profile: Platform_profile_type_id,
  //     platform: Profile_platform_id,
  //     created: Date.now(),
  //     _id: Profile_profile_id,
  //   },
  //   {
  //     fullname: "Immanuel Savvy",
  //     email: "immanuelsavvy@gmail.com",
  //     profile: "fb065baf-c20b-4e13-ad09-60ae040b442e",
  //     platform: "ad4c0eda-cd1a-4513-94bf-1df8d1539977",
  //     created: Date.now(),
  //     _id: "ab065baf-c20b-4e13-ad09-60ae040b44c",
  //   },
  //   {
  //     fullname: "Immanuel Savvy",
  //     email: "immanuelsavvy@gmail.com",
  //     profile: "206497e3-4f20-4ff0-aece-7ebdb6a86796",
  //     platform: "98af501d-13da-40f9-976f-3304b19d2c73",
  //     created: Date.now(),
  //     _id: "306497e3-4f20-4ff0-aece-7ebdb6a86797",
  //   },
  // ];

  // let Platforms = await db.collection("Platforms");

  // let platforms = [
  //   {
  //     name: "Profile",
  //     profile: profiles[0]._id,
  //     uri: "profiles.savvyaisolution.com",
  //     created: Date.now(),
  //     _id: Profile_platform_id,
  //   },
  // ];

  // let ProfileTypes = await db.collection("Profile_types");

  // let profile_types = [
  //   {
  //     name: "Platform",
  //     platform: platforms[0]._id,
  //     created: Date.now(),
  //     _id: Platform_profile_type_id,
  //     description: "Platform Profile Type",
  //   },
  // ];

  // let Tokens = await db.collection("Platform_tokens");
  // let tokens = [
  //   {
  //     platform: platforms[0]._id,
  //     token: "platform_token",
  //     created: Date.now(),
  //     _id: "af626129-86e4-4239-b33d-560782a48245",
  //   },
  // ];

  // let passwords = [
  //   {
  //     profile: profiles[0]._id,
  //     key: hash("123456"),
  //     created: Date.now(),
  //     _id: "b1e426e0-3dc6-4d40-ab6e-0d6f3fa39035",
  //   },
  //   {
  //     profile: profiles[1]._id,
  //     key: hash("123456"),
  //     created: Date.now(),
  //     _id: "c1e426e0-3dc6-4d40-ab6e-0d6f3fa39036",
  //   },
  //   {
  //     profile: profiles[2]._id,
  //     key: hash("123456"),
  //     created: Date.now(),
  //     _id: "a1e426e0-3dc6-4d40-ab6e-0d6f3fa39034",
  //   },
  // ];

  // // await Profiles.insertMany(profiles.slice(1));
  // // await Passwords.insertMany(passwords.slice(1));
  // // await ProfileTypes.insertMany(profile_types);
  // // await Tokens.insertMany(tokens);
  // // await Platforms.insertMany(platforms);
  console.log("Bootstrapped database with initial data");
};

export { boots };
