import { Platform_profile_type_id } from "./platform.js";
import { create_profile, retrieve_setting, signin_user } from "./profiles.js";
import crypto, { createHash, randomBytes, createCipheriv } from "crypto";
import debug from "../../utils/debug.js";

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
  debug("getting token");

  if (platform_instead) {
    profile = await (
      await db.folder("profiles")
    ).findOne({ _id: platform_instead._id });
    profile = profile._id;
  }

  let platform_doc = await (
    await db.folder("Users")
  ).findOne({ uri: platform_uri });

  debug(platform_doc, "platform doc for token request");
  debug(profile, "profile for token request");
  debug(platform, "platform for token request");

  let sess = await (
    await db.folder("Sessions")
  ).findOne({
    platform: platform_doc._id,
    platform_profile: profile,
    third_party_platform: platform._id,
  });

  debug(sess, "session found for token request");

  if (!sess) {
    return {
      ok: false,
      message: "No session found for this profile and platform",
    };
  }

  debug("DID WE EVEN GET HERE", sess);

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
  let { third_party_profile, third_party_platform, profile_type, deviceid } =
    req.body;

  let profile = await get_third_party_profile(
    req,
    third_party_profile,
    third_party_platform,
  );

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

let get_third_party_profile = async (
  req,
  third_party_profile_id,
  third_party_platform_id,
) => {
  let api_key = await (
    await (await req.gp.platform_db()).folder("Tokens")
  ).findOne({ user: third_party_platform_id });

  let profile = await req.gp.call("get_profile", {
    headers: {
      "x-api-key": api_key?.token,
      "x-api-version": "v2",
    },
    body: { profile: third_party_profile_id },
  });

  if (!profile.ok) {
    return {
      ok: false,
      message: "Failed to retrieve third party profile",
    };
  } else profile = profile.data;

  return profile;
};

const get_third_party_reference = async (req, third_party_platform) => {
  let api_key = await (
    await (await req.gp.platform_db()).folder("Tokens")
  ).findOne({ user: third_party_platform });

  let reference = await req.gp.call("get_third_party_reference", {
    headers: {
      "x-api-key": api_key?.token,
      "x-api-version": "v2",
    },
    body: {},
  });

  if (!reference.ok) {
    return {
      ok: false,
      message: "Failed to retrieve third party reference",
    };
  } else reference = reference.data;

  return reference;
};

const signup_with = async (req) => {
  debug("🚀 signup_with started");

  let platform = req.headers.platform;
  debug("📦 Platform:", platform);

  let db = req.db;
  debug("🗄️ DB instance resolved");

  let { third_party_profile, third_party_platform, profile_type, deviceid } =
    req.body;

  debug("📥 Request body:", {
    third_party_profile,
    third_party_platform,
    profile_type,
    deviceid,
  });

  debug("🔎 Fetching third party profile...");
  let profile = await get_third_party_profile(
    req,
    third_party_profile,
    third_party_platform,
  );

  debug("✅ Third party profile fetched:", profile);

  debug("🔎 Fetching third party reference...");
  let third_party_ref = await get_third_party_reference(
    req,
    third_party_platform,
  );

  debug("✅ Third party reference:", third_party_ref);

  process.exit(0);
  let my_profile = {
    fullname: profile.fullname || `${profile.firstname} ${profile.lastname}`,
    email: profile.email,
    firstname: profile.firstname,
    lastname: profile.lastname,
    platform: platform._id,
    profile: profile_type,
    _id: crypto.randomUUID(),
  };

  debug("🧩 Constructed profile object:", my_profile);

  debug("📂 Resolving Profiles folder...");
  let Profiles = await db.folder("profiles");

  debug("🔍 Checking for existing profile...");
  let existing = await Profiles.findOne({
    email: profile.email,
    platform: platform._id,
  });

  debug("📄 Existing profile result:", existing);

  if (existing) {
    debug("❌ Profile already exists");

    return {
      ok: false,
      message: "A profile with this email already exists on this platform",
    };
  }

  debug("💾 Inserting new profile...");
  await Profiles.insertOne(my_profile);

  if (
    platform?._id === process.env.PROFILE_ID &&
    profile_type === Platform_profile_type_id
  ) {
    let Users = await (await req.gp.platform_db()).folder("Users");

    if (!(await Users.findOne({ _id: my_profile._id }))) {
      const cleanName = my_profile.fullname.replace(/\s+/g, "").toLowerCase();
      const emailDomain = email.split("@")[1].toLowerCase();

      if (await Users.findOne({ uri: `${cleanName}.${emailDomain}` })) {
        console.warn(
          "⚠️ User with same URI already exists, skipping user creation in Users folder",
        );
      } else {
        await Users.insertOne({
          _id: my_profile._id,
          uri: `${cleanName}.${emailDomain}`,
          name: my_profile.fullname,
          email: my_profile.email,
        });

        await (
          await (await req.gp.platform_db()).folder("Tokens")
        ).insertOne({
          _id: crypto.randomUUID(),
          token: crypto.randomBytes(32).toString("hex"),
          user: my_profile._id,
        });

        debug("✅ Profile also inserted into Users folder");

        await (
          await (await req.gp.platform_db()).folder("Passwords")
        ).insertOne({
          _id: my_profile._id,
          key: "", // Random password since it's not used for login
        });

        debug("✅ Password entry created for profile");
      }
    }
  }

  debug("✅ Profile inserted");

  debug("🔐 Generating session token...");
  const token = crypto.randomBytes(32).toString("hex");

  debug("🎟️ Generated token:", token);

  debug("📂 Resolving Sessions folder...");
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

  debug("🧩 Session object:", sess);

  debug("💾 Inserting session...");
  await Sessions.insertOne(sess);

  debug("✅ Session inserted");

  debug("🎉 Signup successful");

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
