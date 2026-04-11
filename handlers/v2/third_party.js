import { PROFILE_TYPES, PROFILES, SESSIONS, USERS } from "../../ds/folders.js";
import { signin_user } from "./profiles.js";
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

const get_token = async (req, res) => {
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
    return res.json({
      ok: false,
      message: "No session found for this profile and platform",
    });
  }

  return res.json({
    ok: true,
    message: "Token retrieved",
    token: encryptToken(sess?.token, req.headers["x-api-key"]),
  });
};

const third_party_signin = async (req, res) => {
  let { platform, profile } = req.headers;

  let { details: body, platform_profile } = req.body;

  console.log(platform, profile, platform_profile);
  let result = await signin_user({
    platform: await (await USERS()).findOne({ _id: profile.platform }),
    body: { ...body, profile: profile.profile },
    platform_profile,
    third_party_platform: platform,
  });

  res.json(result);
};

const third_party_auth = async (req, res) => {
  try {
    let platform = req.headers.platform;
    let authorization = req.headers.authorization;
    let xplatform = req.headers["x-platform"];

    if (!authorization) {
      return res.json({
        ok: false,
        message: "Authorization token required",
      });
    }

    authorization = authorization.replace("Bearer ", "");

    const Sessions = await SESSIONS();

    let xplatform_user = await (await USERS()).findOne({ uri: xplatform });

    if (!xplatform_user) {
      return res.json({
        ok: false,
        message: "Invalid x-platform header",
      });
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
      return res.json({
        ok: false,
        message: "Invalid authorization token",
      });
    }

    // ⏳ Check expiration
    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      // 🧹 Optional cleanup
      await Sessions.deleteOne({ _id: session._id });

      return res.json({
        ok: false,
        message: "Session expired",
        code: "SESSION_EXPIRED",
      });
    }

    // ✅ Attach session + user to request

    let user = await (
      await PROFILES()
    ).findOne({
      _id: session.user,
    });

    return res.json({
      ok: true,
      message: "Authentication successful",
      data: {
        profile: user,
        platform,
        third_party_platform: xplatform_user,
      },
    });
  } catch (err) {
    console.error("Auth Middleware Error:", err);

    return res.status(500).json({
      ok: false,
      message: "Internal server error",
    });
  }
};

export { third_party_signin, third_party_auth, get_token };
