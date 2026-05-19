import { hash } from "../../utils/hash.js";

const get_platform_profile = async (req, platform) => {
  let { db } = req;
  platform = platform || req.headers.platform;

  let res = await db.folder("Profiles").findOne({ profile: platform?._id });

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
  let { meta_payload, template, third_party, is_refresh } = options || {};
  let Sessions = await req.db.folder("Sessions");
  let obj = {
    _id: crypto.randomUUID(),
    profile: profile._id,
    platform,
    token: crypto.randomBytes(48).toString("hex"),
    created: Date.now(),
  };
  if (third_party) {
    obj.third_party = third_party.uri;
    obj.third_party_profile = third_party.profile;
  }

  await Sessions.insertOne(obj);

  if (is_refresh) {
    await Sessions.deleteOne({ token: is_refresh });
  }

  // Send signin notification only if email is present.
  if (profile?.email && !is_refresh) {
    let settings = await req.services("settings").call(
      "get_settings",
      { category: [profile.profile], key: ["sessions"] },
      {
        profile: await get_platform_profile(req, platform),
      },
    );

    let session_settings = settings.sessions;

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

const signin = async (req) => {
  let { db } = req;
  let { platform } = req.headers;
  const { credentials, profile_type, meta_payload } = req.body;

  // Get platform identity settings
  // The shape is: { identity: { [profile_type]: { uniques: [ "email" ] } } }
  let settings = await req.services("settings").call(
    "get_settings",
    { category: [profile_type], key: ["identity", "signin"] },
    {
      profile: await get_platform_profile(req, platform),
    },
  );

  let identity_settings = settings.identity;

  if (!identity_settings) {
    // Default to email if not specified
    settings = {
      identity: {
        [profile_type]: {
          uniques: ["email"],
        },
      },
    };
  }

  const Profiles = await db.folder("Profiles");

  // Build query based on unique fields
  let query = { profile: profile_type };
  for (let field of identity_settings.uniques) {
    if (!credentials[field]) {
      return {
        ok: false,
        status: 400,
        message: `Missing unique field: ${field}`,
      };
    }
    query[field] = credentials[field];
  }

  let profile = await Profiles.findOne(query);
  if (!profile) {
    return { ok: false, status: 401, message: "Invalid credentials" };
  }

  let Passwords = await db.folder("Profile_passwords");
  let passwordEntry = await Passwords.findOne({ profile: profile._id });
  if (!passwordEntry) {
    return { ok: false, status: 401, message: "Password not found" };
  }

  if (passwordEntry.key !== hash(credentials.password)) {
    return { ok: false, status: 401, message: "Incorrect password" };
  }

  let signin_settings = settings.signin;

  if (signin_settings) {
    let res = await two_fa_challenge({
      req,
      profile,
      two_fa_settings: signin_settings,
      platform,
      identity_settings,
      meta_payload,
      otp_sub: `${profile_type}_signin`,
      template: {
        otp: "otp-2fa-signin",
        link: "link-2fa-signin",
      },
    });

    return !res.data.ok
      ? res.data
      : {
          ok: true,
          status: 200,
          message: "2fa Initiated",
          data: {
            continuation_token: res.continuation_id,
            two_factor_auth: {
              type: res.two_factor_auth?.type,
            },
          },
        };
  }

  let session_object = await create_session_object(profile, platform, req, {
    meta_payload,
  });

  return {
    ok: true,
    status: 200,
    message: "Signin successful",
    token: session_object.token,
    data: profile,
  };
};

const two_factor_signin = async (req) => {
  let { db, body } = req;
  let { continuation_token, otp, token, profile_type } = body;

  let validation = await validate_continuation(db, continuation_token, {
    otp,
    token,
    sub: `${profile_type}_signin`,
  });
  if (!validation.ok) {
    return validation;
  }

  let { continuation } = validation;

  let Profiles = await db.folder("Profiles");
  let profile = await Profiles.findOne({ _id: continuation.profile });

  if (!profile) {
    return { ok: false, status: 400, message: "Profile not found" };
  }

  let session_object = await create_session_object(
    profile,
    req.headers.platform,
    req,
    { meta_payload: continuation.meta_payload },
  );

  return {
    ok: true,
    status: 200,
    message: "Signin successful",
    token: session_object.token,
    data: profile,
  };
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
    if (two_fa_settings.two_factor_auth?.enabled) {
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

const signup = async (req) => {
  let { db, body, headers, services } = req;
  let { platform } = headers;

  let { details, profile_type, password } = body;

  let settings = await services("settings").call(
    "get_settings",
    { category: [profile_type], key: ["identity", "signup"] },
    {
      profile: await get_platform_profile(req),
    },
  );

  let identity_settings = settings?.identity;

  if (!identity_settings) {
    return {
      ok: false,
      status: 400,
      message: "Invalid profile type",
    };
  }

  let Profiles = await db.folder("Profiles");

  // Ensure unique identity fields are configured and provided
  if (
    !Array.isArray(identity_settings.uniques) ||
    identity_settings.uniques.length === 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "No unique identity fields configured",
    };
  }
  for (let field of identity_settings.uniques) {
    if (!details[field]) {
      return {
        ok: false,
        status: 400,
        message: `Missing unique field: ${field}`,
      };
    }
  }

  // Verify none of the unique identity values are already used for this profile type
  const or = identity_settings.uniques.map((field) => ({
    [field]: details[field],
  }));
  const existing = await Profiles.findOne({ profile: profile_type, $or: or });
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Identity already in use",
      data: { profile_id: existing._id },
    };
  }

  let newProfile = {
    _id: crypto.randomUUID(),
    profile: profile_type,
    platform: platform._id,
    ...details,
    created: new Date(),
  };

  let two_fa_settings = settings?.signup?.two_fa_settings;

  if (two_fa_settings?.enabled) {
    let continuation = await two_fa_challenge({
      req,
      profile: details,
      identity_settings,
      two_fa_settings,
      meta_payload: { new_profile: newProfile, password },
      platform,
      otp_sub: `${profile_type}_signup`,
      template: {
        otp: "otp-2fa-signup",
        link: "link-2fa-signup",
      },
    });

    return !continuation.data.ok
      ? continuation.data
      : {
          ok: true,
          status: 200,
          message: "2fa Initiated",
          data: {
            continuation_token: continuation.continuation_id,
            two_factor_auth: {
              type: continuation.two_factor_auth?.type,
            },
          },
        };
  }

  let res = await Profiles.insertOne(newProfile);

  if (!res.acknowledged) {
    return {
      ok: false,
      status: 500,
      message: "Failed to create profile",
    };
  }

  let Profile_passwords = await db.folder("Profile_passwords");

  await Profile_passwords.insertOne({
    _id: crypto.randomUUID(),
    profile: newProfile._id,
    key: hash(password),
    created: Date.now(),
  });

  let welcome_notification = signup_settings?.notification;
  if (welcome_notification?.enabled) {
    await req.services("aimail").call("send_mail", {
      to: newProfile.email,
      content: {
        template: welcome_notification?.template,
        params: { profile: newProfile },
      },
    });
  }

  return {
    ok: true,
    status: 201,
    message: "Signup successful",
    data: { _id: newProfile._id },
  };
};

const two_factor_signup = async (req) => {
  let { db, body } = req;

  let { continuation_token, otp, token, profile_type } = body;

  let validate = await validate_continuation(db, continuation_token, {
    token,
    otp,
    sub: `${profile_type}_signup`,
  });

  if (!validate?.ok) {
    return validate;
  }

  let { continuation } = validate;
  let new_profile = continuation.meta_payload.new_profile;
  let Profiles = await db.folder("Profiles");

  // Re-fetch identity settings to validate uniques still available
  let settings = await req.services("settings").call(
    "get_settings",
    {
      category: {
        or: [profile_type, "general"],
      },
      key: ["identity", "signup"],
    },
    { profile: await get_platform_profile(req) },
  );

  let identity_settings = settings?.identity;

  if (!identity_settings) {
    return { ok: false, status: 400, message: "Invalid profile type" };
  }

  if (
    !Array.isArray(identity_settings.uniques) ||
    identity_settings.uniques.length === 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "No unique identity fields configured",
    };
  }

  // Ensure all unique fields are present on the new profile
  for (let field of identity_settings.uniques) {
    if (!new_profile[field]) {
      return {
        ok: false,
        status: 400,
        message: `Missing unique field: ${field}`,
      };
    }
  }

  // Verify none of the unique identity values have been taken in the meantime
  const or = identity_settings.uniques.map((field) => ({
    [field]: new_profile[field],
  }));
  const existing = await Profiles.findOne({
    profile: new_profile.profile,
    $or: or,
  });
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Identity already in use",
      data: { profile_id: existing._id },
    };
  }

  // Safe to insert
  await Profiles.insertOne(new_profile);

  // If a password was forwarded in the continuation payload, persist it as well
  let password = continuation.meta_payload.password;
  if (password) {
    let Profile_passwords = await db.folder("Profile_passwords");
    await Profile_passwords.insertOne({
      _id: crypto.randomUUID(),
      profile: new_profile._id,
      key: hash(password),
      created: Date.now(),
    });
  }

  let signup_setting = settings?.signup;

  if (signup_setting?.notification?.enabled) {
    await req.services("aimail").call("send_mail", {
      to: new_profile.email,
      content: {
        template: signup_setting?.template,
        params: { profile: new_profile },
      },
    });
  }

  return {
    ok: true,
    status: 201,
    message: "Signup successful",
    data: new_profile,
  };
};

const forgot_password = async (req) => {
  let { db, body, headers } = req;
  let { platform } = headers;
  let { identity, profile_type } = body;

  let settings = await req.services("settings").call(
    "get_settings",
    { category: [profile_type], key: ["identity", "forgot_password"] },
    {
      profile: await get_platform_profile(req, platform),
    },
  );

  let identity_settings = settings.identity;

  if (!identity_settings) {
    return {
      ok: false,
      status: 400,
      message: "Invalid profile type",
    };
  }

  if (!identity_settings.uniques || identity_settings.uniques.length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No unique identity fields configured",
    };
  }

  let query = { profile: profile_type };
  for (let field of identity_settings.uniques) {
    if (!identity[field]) {
      return {
        ok: false,
        status: 400,
        message: `Missing unique field: ${field}`,
      };
    }
    query[field] = identity[field];
  }

  let Profiles = await db.folder("Profiles");
  let profile = await Profiles.findOne(query);
  if (!profile) {
    return { ok: false, status: 404, message: "Profile not found" };
  }

  let forgot_password_settings = settings.forgot_password;

  if (forgot_password_settings?.enabled) {
    let res = await two_fa_challenge({
      req,
      profile,
      two_fa_settings: forgot_password_settings.two_fa_settings,
      identity_settings,
      platform,
      meta_payload: { profile_id: profile._id },
      otp_sub: `${profile_type}_forgot_password`,
      template: {
        otp: "otp_2fa_forgot_password",
        link: "link_2fa_forgot_password",
      },
    });

    return !res.data.ok
      ? res.data
      : {
          ok: true,
          status: 200,
          message: "Forgot password 2fa initiated",
          data: {
            continuation_token: res.continuation_id,
            two_factor_auth: {
              type: res.two_factor_auth?.type,
            },
          },
        };
  }

  return {
    ok: false,
    status: 400,
    message: "Forgot password not enabled for this profile type",
  };
};

const reset_password = async (req) => {
  let { db, body } = req;
  let { continuation_token, otp, token, profile_type, new_password } = body;

  let validation = await validate_continuation(db, continuation_token, {
    otp,
    token,
    sub: `${profile_type}_forgot_password`,
  });
  if (!validation.ok) {
    return validation;
  }

  let { continuation } = validation;

  let Profile_passwords = await db.folder("Profile_passwords");
  await Profile_passwords.updateOne(
    { profile: continuation.meta_payload.profile_id },
    { $set: { key: hash(new_password), updated: Date.now() } },
  );

  let settings = await req.services("settings").call(
    "get_settings",
    { category: [profile_type], key: ["identity", "forgot_password"] },
    {
      profile: await get_platform_profile(req),
    },
  );

  let forgot_password_settings = settings.forgot_password;

  if (forgot_password_settings?.notification?.enabled) {
    let Profiles = await db.folder("Profiles");
    let profile = await Profiles.findOne({
      _id: continuation.meta_payload.profile_id,
    });

    await req.services("aimail").call(
      "send_mail",
      {
        to: profile.email,
        content: {
          template:
            forgot_password_settings.notification.template || "password_reset",
          params: { profile },
        },
      },
      { profile: await get_platform_profile(req) },
    );
  }

  return {
    ok: true,
    status: 200,
    message: "Password reset successful",
  };
};

const refresh_token = async (req) => {
  let { headers, db } = req;
  let { profile, authorization } = headers;

  let res = await create_session_object(profile, platform, req, {
    is_refresh: authorization,
  });

  return {
    ok: true,
    message: "Token refreshed",
    data: res,
  };
};

const update_profile = async (req) => {
  let { db, headers, body } = req;

  let { profile, platform } = headers;

  let { updates = {} } = body;

  if (!updates || typeof updates !== "object") {
    return {
      ok: false,
      status: 400,
      message: "Invalid updates payload",
    };
  }

  let settings = await req.services("settings").call(
    "get_settings",
    {
      category: [profile.profile],
      key: ["identity"],
    },
    {
      profile: await get_platform_profile(req, platform),
    },
  );

  let identity_settings = settings?.identity;

  const protected_fields = ["_id", "profile", "platform", "created"];

  const unique_fields = identity_settings?.uniques || [];

  const updatingUnique = unique_fields.filter((f) =>
    Object.prototype.hasOwnProperty.call(updates, f),
  );
  if (updatingUnique.length) {
    return {
      ok: false,
      status: 400,
      message: `Cannot update unique field(s): ${updatingUnique.join(
        ", ",
      )}. Use /updateprofileidentity endpoint instead`,
    };
  }

  for (let field of [...protected_fields]) {
    delete updates[field];
  }

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No valid fields to update",
    };
  }

  let Profiles = await db.folder("Profiles");

  await Profiles.updateOne(
    {
      _id: profile._id,
    },
    {
      $set: {
        ...updates,
        updated: Date.now(),
      },
    },
  );

  let updated_profile = await Profiles.findOne({
    _id: profile._id,
  });

  return {
    ok: true,
    status: 200,
    message: "Profile updated successfully",
    data: updated_profile,
  };
};

const update_profile_identity = async (req) => {
  let { db, headers, body } = req;

  let { profile, platform } = headers;

  let { identity } = body;

  if (!identity || typeof identity !== "object") {
    return {
      ok: false,
      status: 400,
      message: "Invalid identity payload",
    };
  }

  // Remove forbidden fields so callers cannot change core identifiers
  const forbiddenFields = ["_id", "profile", "platform"];
  for (const f of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(identity, f)) {
      delete identity[f];
    }
  }

  if (Object.keys(identity).length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No valid identity fields to update",
    };
  }

  let settings = await req.services("settings").call(
    "get_settings",
    {
      category: [profile.profile],
      key: ["identity", "update_profile_identity"],
    },
    {
      profile: await get_platform_profile(req, platform),
    },
  );

  let identity_settings = settings?.identity;

  if (!identity_settings) {
    return {
      ok: false,
      status: 400,
      message: "Identity settings not found",
    };
  }

  if (
    !Array.isArray(identity_settings.uniques) ||
    identity_settings.uniques.length === 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "No unique identity fields configured",
    };
  }

  for (let field of identity_settings.uniques) {
    if (!identity[field]) {
      return {
        ok: false,
        status: 400,
        message: `Missing identity field: ${field}`,
      };
    }
  }

  let Profiles = await db.folder("Profiles");

  const or = identity_settings.uniques.map((field) => ({
    [field]: identity[field],
  }));

  let existing = await Profiles.findOne({
    profile: profile.profile,
    $or: or,
    _id: {
      $ne: profile._id,
    },
  });

  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Identity already in use",
      data: {
        profile_id: existing._id,
      },
    };
  }

  let update_settings = settings?.update_profile_identity;

  if (update_settings?.two_fa_settings?.enabled) {
    let continuation = await two_fa_challenge({
      req,
      profile,
      identity_settings,
      two_fa_settings: update_settings.two_fa_settings,
      platform,
      meta_payload: {
        identity,
      },
      otp_sub: `${profile.profile}_update_identity`,
      template: {
        otp: "otp_2fa_update_identity",
        link: "link_2fa_update_identity",
      },
    });

    return !continuation.data.ok
      ? continuation.data
      : {
          ok: true,
          status: 200,
          message: "Identity update verification initiated",
          data: {
            continuation_token: continuation.continuation_id,
            two_factor_auth: {
              type: continuation.type,
            },
          },
        };
  }

  await Profiles.updateOne(
    {
      _id: profile._id,
    },
    {
      $set: {
        ...identity,
        updated: Date.now(),
      },
    },
  );

  let updated_profile = await Profiles.findOne({
    _id: profile._id,
  });

  return {
    ok: true,
    status: 200,
    message: "Identity updated successfully",
    data: updated_profile,
  };
};

const confirm_update_profile_identity = async (req) => {
  let { db, body, headers } = req;
  let { profile: user_profile } = headers;
  let profile_type = user_profile.profile;

  let { continuation_token, otp, token } = body;

  let validation = await validate_continuation(db, continuation_token, {
    otp,
    token,
    sub: `${profile_type}_update_identity`,
  });

  if (!validation.ok) {
    return validation;
  }

  let { continuation } = validation;

  let Profiles = await db.folder("Profiles");

  let profile = await Profiles.findOne({
    _id: continuation.profile,
  });

  if (!profile) {
    return {
      ok: false,
      status: 404,
      message: "Profile not found",
    };
  }

  let settings = await req.services("settings").call(
    "get_settings",
    {
      category: [profile.profile],
      key: ["identity"],
    },
    {
      profile: await get_platform_profile(req, headers.platform),
    },
  );

  let identity_settings = settings.identity;

  const identity = continuation.meta_payload.identity;

  const or = identity_settings.uniques.map((field) => ({
    [field]: identity[field],
  }));

  let existing = await Profiles.findOne({
    profile: profile.profile,
    $or: or,
    _id: {
      $ne: profile._id,
    },
  });

  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Identity already in use",
    };
  }

  await Profiles.updateOne(
    {
      _id: profile._id,
    },
    {
      $set: {
        ...identity,
        updated: Date.now(),
      },
    },
  );

  let updated_profile = await Profiles.findOne({
    _id: profile._id,
  });

  return {
    ok: true,
    status: 200,
    message: "Identity updated successfully",
    data: updated_profile,
  };
};

export {
  signin,
  signup,
  two_factor_signin,
  two_factor_signup,
  forgot_password,
  reset_password,
  refresh_token,
  update_profile,
  update_profile_identity,
  confirm_update_profile_identity,
};
