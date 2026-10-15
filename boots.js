import { MongoClient } from "mongodb";
import { Mongo } from "@godprotocol/repositories";
import crypto from "crypto";

const hash = (password, alg = "sha256") => {
  return crypto.createHash(alg).update(password).digest("hex");
};

const boots = async () => {
  return;
  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: "v3-profiles",
  });

  let Profiles = await db.collection("Profile_tokens");

  return console.log(
    JSON.stringify(
      await Profiles.find({
        profile: "50791212-04df-46ae-bf35-4aab30c28aa1",
      }).toArray(),
      null,
      2,
    ),
  );

  console.log("Bootstrapped database with initial data");
};

export { boots };
