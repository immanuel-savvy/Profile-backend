import { get_settings } from "./settings.js";

const get_platform_profile = async (req, platform) => {
  let { db } = req;
  platform = platform || req.headers.platform;

  let res = await (
    await db.folder("Profiles")
  ).findOne({ profile: platform?._id });

  return res;
};

const generate_otp = async ({
  db,
  length = 6,
  expiry = 5,
  charset_type = "num",
  identity,
  sub = "general",
}) => {
  let otp = "";
  let folder = await db.folder(`Otps:${sub}`);
  if (!Array.isArray(identity)) {
    identity = [identity];
  }

  // Define character sets
  const charsets = {
    num: "0123456789",
    alpha: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    alnum: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    hex: "0123456789abcdef",
  };

  const chars = charsets[charset_type] || charsets["num"];

  // Generate OTP using crypto for secure randomness
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, chars.length);
    otp += chars[idx];
  }

  // Prepare document fields
  const now = new Date();
  const expires_at = new Date(now.getTime() + expiry * 60 * 1000);

  const doc = {
    _id: crypto.randomUUID(),
    identity,
    key: hash(otp),
    created: now,
    expires_at,
  };

  // If an OTP already exists for any of these identities, reuse its _id so callers
  // can get the real document id after the upsert. Otherwise the generated doc._id
  // will be used for the insert.
  const existing = await folder.findOne({ identity: { $in: identity } });
  if (existing && existing._id) {
    doc._id = existing._id;
  }
  await folder.updateOne(
    { identity: { $in: identity } },
    {
      $set: { key: doc.key, expires_at: doc.expires_at },
      $setOnInsert: doc,
    },
    { upsert: true },
  );

  // Return plain OTP so caller can send it to user, and the id to reference it
  return { ok: true, _id: doc._id, identity, otp, expires_at };
};

const create_session_object = async (profile, platform, req, options) => {
  let {
    meta_payload,
    session_settings,
    template,
    third_party,
    is_refresh,
    by,
  } = options || {};

  let Sessions = await req.db.folder("Sessions");
  let obj = {
    _id: crypto.randomUUID(),
    profile: profile._id,
    profile_type: profile.profile,
    platform: platform._id,
    platform_uri: platform.uri,
    token: crypto.randomBytes(48).toString("hex"),
    created: Date.now(),
  };
  if (third_party) {
    obj.third_party_uri = third_party.uri;
    obj.third_party_profile = third_party.profile;
  }
  if (by) {
    obj.by = by;
  }

  await Sessions.insertOne(obj);

  if (is_refresh) {
    await Sessions.deleteOne({ token: is_refresh });
  }

  // Send signin notification only if email is present.
  if (profile?.email && !is_refresh) {
    if (!session_settings) {
      let settings = await get_settings({
        req,
        body: { category: [profile.profile], key: ["sessions"] },
      });

      session_settings = settings?.sessions;
    }

    if (session_settings?.notify?.enabled) {
      await req.services("aimail").call(
        "send_mail",
        {
          to: profile.email,
          content: {
            template:
              session_settings.notify?.template ||
              template ||
              "signin-notification",
            params: {
              profile,
              device: meta_payload?.device,
              datetime: {
                date: new Date().toDateString(),
                time: new Date().toTimeString(),
              },
            },
          },
        },
        { profile: await get_platform_profile(req, platform) },
      );
    }
  }

  return obj;
};

const validate_continuation = async (db, continuation_token, props) => {
  let { otp, token, sub = "general" } = props;
  let continuation_db = await db.folder("2fa_continuations");
  let continuation = await continuation_db.findOne({ _id: continuation_token });

  if (!continuation) {
    return { ok: false, status: 400, message: "Invalid continuation token" };
  }
  if (continuation.type === "otp") {
    let otp_folder = await db.folder(`Otps:${sub}`);
    let otp_entry = await otp_folder.findOne({ _id: continuation_token });

    if (!otp_entry || otp_entry.expires_at < new Date()) {
      return { ok: false, status: 400, message: "OTP expired or invalid" };
    }

    if (otp_entry.key !== hash(otp)) {
      return { ok: false, status: 400, message: "Incorrect OTP" };
    }
    await otp_folder.deleteOne({ _id: otp_entry._id });
  } else if (continuation.type === "link") {
    let Reset_tokens = await db.folder("Reset_tokens");
    let token_entry = await Reset_tokens.findOne({
      key: hash(token),
      type: sub,
    });

    if (!token_entry || token_entry.expires_at < new Date()) {
      return { ok: false, status: 400, message: "Token expired or invalid" };
    }
    if (token_entry.type !== "signin") {
      return { ok: false, status: 400, message: "Invalid token type" };
    }

    await Reset_tokens.deleteOne({ _id: token_entry._id });
  } else {
    return { ok: false, status: 400, message: "Invalid continuation type" };
  }

  continuation_db.deleteOne({ _id: continuation_token });

  return { ok: true, continuation };
};

const two_fa_challenge = async ({
  req,
  profile,
  two_fa_settings,
  identity_settings,
  platform,
  meta_payload,
  otp_sub,
  template = {},
}) => {
  let { db } = req;

  if (two_fa_settings) {
    let signin_response, continuation;
    if (two_fa_settings?.enabled) {
      if (two_fa_settings.two_factor_auth?.type === "otp") {
        continuation = await generate_otp({
          db,
          identity: identity_settings.uniques.map((field) => profile[field]),
          sub: otp_sub,
          length: two_fa_settings.two_factor_auth.otp?.length,
          expiry: two_fa_settings.two_factor_auth.otp?.expiry,
          charset_type: two_fa_settings.two_factor_auth.otp?.charset,
        });

        if (identity_settings.uniques.includes("email")) {
          signin_response = await req.services("aimail").call(
            "send_mail",
            {
              to: profile.email,
              content: {
                template:
                  two_fa_settings.two_factor_auth.otp?.template || template.otp,
                params: {
                  otp: otp_res.otp,
                  expiry: Math.ceil((otp_res.expires_at - new Date()) / 60000),
                  profile,
                },
              },
            },
            { profile: await get_platform_profile(req, platform) },
          );

          if (!signin_response.ok) signin_response = null;
        }
        if (!signin_response && identity_settings.uniques.includes("phone")) {
          signin_response = await req.services("aimail").call(
            "send_message",
            {
              to: profile.phone,
              content: {
                template:
                  two_fa_settings.two_factor_auth.otp?.template || template.otp,
                params: {
                  otp: otp_res.otp,
                  expiry: Math.ceil((otp_res.expires_at - new Date()) / 60000),
                  profile,
                },
              },
            },
            { profile: await get_platform_profile(req, platform) },
          );
        }
      } else if (two_fa_settings.two_factor_auth?.type === "link") {
        let Reset_tokens = await db.folder("Reset_tokens");
        let token = crypto.randomBytes(48).toString("hex");
        continuation = {
          _id: crypto.randomUUID(),
          profile: profile._id,
          key: hash(token),
          type: otp_sub || "signin",
          created: Date.now(),
          expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiry
        };
        await Reset_tokens.insertOne(continuation);

        if (identity_settings.uniques.includes("email")) {
          signin_response = await req.services("aimail").call(
            "send_mail",
            {
              to: profile.email,
              content: {
                template:
                  two_fa_settings.two_factor_auth.link?.template ||
                  template.link,
                params: {
                  link: `${two_fa_settings.two_factor_auth.link.url}?token=${token}`,
                  profile,
                },
              },
            },
            { profile: await get_platform_profile(req, platform) },
          );

          if (!signin_response.ok) signin_response = null;
        }
        if (!signin_response && identity_settings.uniques.includes("phone")) {
          signin_response = await req.services("aimail").call(
            "send_message",
            {
              to: profile.phone,
              content: {
                template:
                  two_fa_settings.two_factor_auth.link?.template ||
                  template.link,
                params: {
                  link: `${two_fa_settings.two_factor_auth.link.url}?token=${token}`,
                  profile,
                },
              },
            },
            { profile: await get_platform_profile(req, platform) },
          );
        }
      }

      let continuation_db = await db.folder("2fa_continuations");
      await continuation_db.insertOne({
        _id: continuation._id,
        profile: profile._id,
        type: two_fa_settings.two_factor_auth?.type,
        data: signin_response,
        created: Date.now(),
        meta_payload,
      });

      return {
        continuation_id: continuation?._id,
        type: two_fa_settings.two_factor_auth?.type,
        data: signin_response,
      };
    }
  }
};

export {
  validate_continuation,
  generate_otp,
  create_session_object,
  get_platform_profile,
  two_fa_challenge,
};
