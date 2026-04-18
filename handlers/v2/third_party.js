import { PROFILE_TYPES, PROFILES, SESSIONS, USERS } from "../../ds/folders.js";
import { retrieve_setting, signin_user } from "./profiles.js";
import crypto, { createHash, randomBytes, createCipheriv } from "crypto";

const deriveKey = (secret) =>
  createHash("sha256").update(String(secret)).digest();
/**
 * Encrypt a value (usually a session token) using AES-256-GCM.
 * Returns a compact base64 string encoding iv|authTag|ciphertext.
 */
export const encryptToken = (payload, secret) => {
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
  let { profile, platform_uri } = req.body;

  let platform_doc = await (await USERS()).findOne({ uri: platform_uri });

  console.log(platform_doc, "platform doc for token request");
  console.log(profile, "profile for token request");
  console.log(platform, "platform for token request");
  let sess = await (
    await SESSIONS()
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

  return {
    ok: true,
    message: "Token retrieved",
    token: encryptToken(sess?.token, req.headers["x-api-key"]),
  };
};

const third_party_signin = async (req) => {
  let { platform, profile } = req.headers;

  let { details: body, platform_profile } = req.body;

  console.log(platform, profile, platform_profile);
  let result = await signin_user({
    platform: await (await USERS()).findOne({ _id: profile.platform }),
    body: { ...body, profile: profile.profile },
    platform_profile,
    third_party_platform: platform,
  });

  return result;
};

const third_party_auth = async (req) => {
  let platform = req.headers.platform;
  let authorization = req.headers.authorization;
  let xplatform = req.headers["x-platform"];

  if (!authorization) {
    return {
      ok: false,
      message: "Authorization token required",
    };
  }

  authorization = authorization.replace("Bearer ", "");

  const Sessions = await SESSIONS();

  let xplatform_user = await (await USERS()).findOne({ uri: xplatform });

  if (!xplatform_user) {
    return {
      ok: false,
      message: "Invalid x-platform header",
    };
  }

  // console.log(xplatform_user, "xplatform user");
  // console.log(platform, "platform header");
  // console.log(authorization);

  let session = await Sessions.findOne({
    platform: platform._id,
    token: authorization,
    third_party_platform: xplatform_user._id,
  });

  if (!session) {
    return {
      ok: false,
      message: "Invalid authorization token",
    };
  }

  // ⏳ Check expiration
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    // 🧹 Optional cleanup
    await Sessions.deleteOne({ _id: session._id });

    return {
      ok: false,
      message: "Session expired",
      code: "SESSION_EXPIRED",
    };
  }

  // ✅ Attach session + user to request

  let user = await (
    await PROFILES()
  ).findOne({
    _id: session.user,
  });

  return {
    ok: true,
    message: "Authentication successful",
    data: {
      profile: user,
      platform,
      third_party_platform: xplatform_user,
    },
  };
};

const signup_with = async (req) => {
  let {
    xplatform: xplatform_uri,
    platform,
    authorization,
    profile,
  } = req.headers;
  let { permissions, profile_type } = req.body;

  let xplatform = await (await USERS()).findOne({ uri: xplatform_uri });

  let setting = await retrieve_setting(platform, {
    category: ["webhooks", "identity", "profile_schema"],
  });

  let { profile_schema, identity, webhooks } = setting || {};
  if (!identity) {
    identity = {
      unique_ids: { properties: ["email"], query: "and" },
    };
  }

  let xprofile = {};

  if (identity) {
    let unids = identity.unique_ids;
    if (unids.query === "and") {
      for (let i = 0; i < unids.properties.length; i++) {
        let property = unids.properties[i];
        if (!profile[property]) {
          return {
            ok: false,
            message: "Incomplete profile data",
          };
        }
        xprofile[property] = profile[property];
      }
    } else if (unids.query === "or") {
      let uid = {};
      for (let i = 0; i < unids.properties.length; i++) {
        let property = unids.properties[i];

        if (profile[property]) uid[property] = profile[property];
      }
      if (!Object.keys(uid).length)
        return {
          ok: false,
          message: "Incomplete profile data",
        };
      xprofile = { ...xprofile, ...uid };
    }
  }

  let Profiles = await PROFILES();
  if (Object.keys(xprofile).length) {
    let exists = await Profiles.findOne({
      $or: xprofile,
      profile: profile_type,
    });
    if (exists) {
      return {
        ok: false,
        message: "Profile with provided unique fields already exists",
      };
    }
  }

  for (let prop in profile_schema) {
    let val = profile_schema[prop];

    let profile_val = profile[prop];
    if (val.required && !profile_val) {
      return {
        ok: false,
        message: "Incomplete profile schema",
      };
    }
    if (val.validation) {
      if (String(profile[prop]).match(val.validation)) {
        return {
          ok: false,
          message: "Invalid schema match",
        };
      }
    }
    xprofile[prop] = profile[prop];
  }

  xprofile.profile = profile_type;
  xprofile.platform = platform._id;

  xprofile._id = crypto.randomUUID();
  xprofile.created = new Date();
  xprofile.verified = xplatform_uri;
  xprofile.verifiedAt = new Date();

  await Profiles.insertOne(xprofile);

  const Sessions = await SESSIONS();

  let sess = {
    _id: crypto.randomUUID(),
    token: crypto.randomBytes(32).toString("hex"),
    user: xprofile._id,
    platform: platform._id,
    profile: xprofile.profile,
    platform_profile: null,
    created: new Date(),
  };
  let xsess = {
    _id: crypto.randomUUID(),
    token: crypto.randomBytes(32).toString("hex"),
    user: xprofile._id,
    platform: platform._id,
    profile: xprofile.profile,
    platform_profile: profile._id,
    created: new Date(),
    third_party_platform: xplatform._id,
  };

  await Sessions.insertMany([sess, xsess]);

  return {
    ok: true,
    message: "Profile created",
    token: sess.token,
    data: xprofile,
  };
};

export { third_party_signin, third_party_auth, get_token, signup_with };
