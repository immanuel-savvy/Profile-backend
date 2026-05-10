import { create_profile, retrieve_setting, signin_user } from "./profiles.js";
import crypto, { createHash, randomBytes, createCipheriv } from "crypto";

const deriveKey = (secret) =>
  createHash("sha256").update(String(secret)).digest();
/**
 * Encrypt a value (usually a session token) using AES-256-GCM.
 * Returns a compact base64 string encoding iv|authTag|ciphertext.
 */
const decryptToken = (enc, secret) => {
  if (!enc) return null;

  try {
    const key = deriveKey(secret);

    const parts = enc.split(":");
    if (parts.length < 3) throw new Error("Invalid token format");

    const iv = Buffer.from(parts[0], "base64");
    const tag = Buffer.from(parts[1], "base64");
    const data = Buffer.from(parts.slice(2).join(":"), "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(decrypted);
  } catch (err) {
    console.error("❌ Decrypt failed:", err.message);
    return null;
  }
};

const encryptToken = (payload, secret) => {
  const key = deriveKey(secret);
  const iv = randomBytes(12); // GCM standard

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // iv:tag:data
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
};

const get_token = async (req) => {
  let platform = req.headers.platform;
  let { profile, platform: platform_instead, platform_uri } = req.body;
  let db = req.db;
  console.log("getting token");

  if (platform_instead) {
    profile = await (
      await db.folder("profiles")
    ).findOne({ _id: platform_instead._id });
    profile = profile._id;
  }

  let platform_doc = await (
    await db.folder("Users")
  ).findOne({ uri: platform_uri });

  console.log(platform_doc, "platform doc for token request");
  console.log(profile, "profile for token request");
  console.log(platform, "platform for token request");

  let sess = await (
    await db.folder("Sessions")
  ).findOne({
    platform: platform_doc._id,
    platform_profile: profile,
    third_party_platform: platform._id,
  });

  console.log(sess, "session found for token request");

  if (!sess) {
    return {
      ok: false,
      message: "No session found for this profile and platform",
    };
  }

  console.log("DID WE EVEN GET HERE", sess);

  return {
    ok: true,
    message: "Token retrieved",
    token: sess?.token,
  };
};

const third_party_signin = async (req) => {
  let platform = req.headers.platform;
  let profile = req.headers.profile;
  let db = req.db;
  let { third_party_reference, profile_type, credentials } = req.body;

  if (!profile) {
    return {
      ok: false,
      message: "Profile header required",
    };
  }

  let third_party_profile = await (
    await db.folder("Third_parties")
  ).findOne({ _id: third_party_reference });

  let third_party_platform = await (
    await db.folder("Users")
  ).findOne({ _id: third_party_profile.uri });

  let res = await signin_user(
    {
      platform: third_party_platform,
      third_party_platform: platform,
      body: {
        ...credentials,
        profile: profile_type,
      },
    },
    { db },
  );

  return res;
};

const signin_with = async (req) => {
  let platform = req.headers.platform;
  let db = req.db;
  let { third_party_profile, profile_type, deviceid } = req.body;

  let profile = await (
    await db.folder("profiles")
  ).findOne({ _id: third_party_profile });

  if (!profile) {
    return {
      ok: false,
      message: "Third party profile not found",
    };
  }

  let my_profile = await (
    await db.folder("profiles")
  ).findOne({
    email: profile.email,
    platform: platform._id,
    profile: profile_type,
  });

  if (!my_profile) {
    return {
      ok: false,
      message: "No matching profile found for this third party profile",
    };
  }
  // 🔐 Create session
  const token = crypto.randomBytes(32).toString("hex");

  const Sessions = await db.folder("Sessions");

  let sess = {
    _id: crypto.randomUUID(),
    token,
    user: my_profile._id,
    platform: platform._id,
    profile: my_profile.profile,
    created: new Date(),
    deviceid,
  };
  await Sessions.insertOne(sess);

  return {
    ok: true,
    message: "Signin successful",
    token,
    data: my_profile,
  };
};

const signup_with = async (req) => {
  let platform = req.headers.platform;
  let db = req.db;
  let { third_party_profile, profile_type, deviceid } = req.body;

  let profile = await (
    await db.folder("profiles")
  ).findOne({ _id: third_party_profile });

  let my_profile = {
    fullname: profile.fullname,
    email: profile.email,
    firstname: profile.firstname,
    lastname: profile.lastname,
    platform: platform._id,
    profile: profile_type,
    _id: crypto.randomUUID(),
  };

  await db.folder("profiles").insertOne(my_profile);

  const token = crypto.randomBytes(32).toString("hex");

  const Sessions = await db.folder("Sessions");

  let sess = {
    _id: crypto.randomUUID(),
    token,
    user: my_profile._id,
    platform: platform._id,
    profile: my_profile.profile,
    created: new Date(),
    deviceid,
  };
  await Sessions.insertOne(sess);

  return {
    ok: true,
    message: "Signup successful",
    token,
    data: my_profile,
  };
};

export {
  third_party_signin,
  get_token,
  signup_with,
  signin_with,
  encryptToken,
  decryptToken,
};
