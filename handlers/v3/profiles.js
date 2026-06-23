import crypto from "crypto";
import { hash } from "../../utils/hash.js";
import { get_settings } from "./helpers/settings.js";
import {
  validate_continuation,
  create_session_object,
  get_platform_profile,
  two_fa_challenge,
} from "./helpers/profiles.js";
import { OAuth2Client } from "google-auth-library";

const social_auth = async (social, { auth_cred }) => {
  let { meta, type, data } = social;

  let os = meta?.os || "android";

  if (type === "google") {
    let token = (auth_cred?.[os] || auth_cred?.["default"])?.token;
    const serv = new OAuth2Client(token);

    // 1. Verify Google ID token
    const ticket = await serv.verifyIdToken({
      idToken: data.idToken,
      audience: token,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.json({
        ok: false,
        message: "Could not verify Google ID token",
      });
    }

    const email = payload.email?.trim().toLowerCase();
    const firstname = payload.given_name || payload.givenName || "";
    const lastname = payload.family_name || payload.familyName || "";
    const picture = payload.picture || payload.photo;

    if (!email) {
      return {
        ok: false,
        message: "Google account does not contain a valid email",
      };
    }

    return {
      ok: true,
      data: {
        email,
        firstname,
        lastname,
        image: picture,
        fullname: `${firstname} ${lastname}`,
      },
    };
  }
};

const signin = async (req) => {
  let { db } = req;
  let { platform } = req.headers;
  let { credentials, social, profile_type, meta_payload } = req.body;

  let Profile_types = await db.folder("Profile_types");
  let profile_type_entry = await Profile_types.findOne({
    _id: profile_type,
    platform: platform._id,
  });

  if (!profile_type_entry) {
    return { ok: false, status: 400, message: "Invalid profile type" };
  }

  // Get platform identity settings
  // The shape is: { identity:  { uniques: [ "email" ] } }
  let settings = await get_settings({
    req,
    body: { category: [platform._id], key: ["identity", "signin", "session"] },
  });

  let identity_settings = settings?.identity;

  if (!identity_settings) {
    // Default to email if not specified
    identity_settings = {
      uniques: ["email"],
    };
  }

  const Profiles = await db.folder("Profiles");

  if (social) {
    let creds = await social_auth(social, {
      auth_cred: identity_settings.socials?.[social?.type],
    });

    if (!creds?.ok) {
      return creds;
    }

    credentials = { ...creds.data };
  }

  // Build query based on unique fields
  let query = { profile: profile_type, platform: platform._id };

  for (let field of identity_settings?.uniques) {
    if (credentials[field]) query[field] = credentials[field];
  }

  if (Object.keys(query).length === 2) {
    return {
      ok: false,
      status: 400,
      message: `Missing identities field(s) of: ${identity_settings.uniques.join(",")}`,
    };
  }

  let profile = await Profiles.findOne(query);
  if (!profile) {
    if (social) {
      let res = await signup(
        { ...req, body: { social: credentials, profile_type, password: "" } },
        { from: "signin" },
      );

      return res;
    }
    return { ok: false, status: 401, message: "Invalid credentials" };
  }

  if (!social) {
    let Passwords = await db.folder("Profile_passwords");
    let passwordEntry = await Passwords.findOne({ profile: profile._id });
    if (!passwordEntry) {
      return { ok: false, status: 401, message: "Password not found" };
    }

    if (passwordEntry.key !== hash(credentials.password)) {
      return { ok: false, status: 401, message: "Incorrect password" };
    }

    let signin_settings = settings?.signin;

    if (signin_settings?.two_fa_settings?.enabled) {
      let res = await two_fa_challenge({
        req,
        profile,
        two_fa_settings: signin_settings?.two_fa_settings,
        platform,
        profile_type: profile_type_entry,
        identity_settings,
        meta_payload,
        otp_sub: `${profile_type}_signin`,
        template: {
          otp: "otp-2fa-signin",
          link: "link-2fa-signin",
        },
      });

      return !res.ok
        ? res
        : {
            ok: true,
            status: 200,
            message: "2fa Initiated",
            data: {
              continuation_token: res.continuation_id,
              two_factor_auth: {
                type: res?.type,
              },
            },
          };
    }
  }

  let session_object = await create_session_object(profile, platform, req, {
    meta_payload,
    session_settings: settings?.session,
  });

  return {
    ok: true,
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

const signup = async (req, opts) => {
  let { from } = opts || {};
  let { db, body, headers } = req;
  let { platform } = headers;

  let { details, social, profile_type, password } = body;

  let profile_type_entry = await (
    await db.folder("Profile_types")
  ).findOne({ _id: profile_type, platform: platform._id });
  if (!profile_type_entry) {
    return {
      ok: false,
      message: "Profile type not found",
      status: 404,
    };
  }

  let settings = await get_settings({
    req,
    body: { category: [platform._id], key: ["identity", "signup"] },
  });

  let identity_settings = settings?.identity;

  if (!identity_settings) {
    identity_settings = {
      uniques: ["email"],
    };
  }

  if (social) {
    let creds;
    if (from === "signin") {
      creds = social;
    } else {
      let creds = await social_auth(social, {
        auth_cred: identity_settings?.socials?.[social.type],
      });

      if (!creds.ok) {
        return creds;
      }
    }

    details = { ...creds };
  }

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

  let det = 0;
  for (let identity of identity_settings.uniques) {
    if (details[identity]) det++;
  }
  if (!det) {
    return {
      ok: false,
      message: `Missing identity fields: ${identity_settings.uniques.join(",")}`,
    };
  }

  let Profiles = await db.folder("Profiles");

  // Verify none of the unique identity values are already used for this profile type

  const or = identity_settings.uniques
    .filter((field) => details[field] !== undefined)
    .map((field) => ({
      [field]: details[field],
    }));
  const existing = await Profiles.findOne({ profile: profile_type, $or: or });
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Identity already in use",
      data: { profile_id: existing._id, details: or },
    };
  }

  let newProfile = {
    _id: crypto.randomUUID(),
    profile: profile_type,
    platform: platform._id,
    ...details,
    created: Date.now(),
  };

  let signup_settings = settings?.signup;
  if (!social) {
    let two_fa_settings = signup_settings?.two_fa_settings;
    if (!two_fa_settings) {
      two_fa_settings = {
        enabled: true,
        two_factor_auth: {
          type: "otp",
          otp: {
            length: 6,
            charset: "alnum",
            expiry: 5,
            template: "otp-2fa-signup",
          },
        },
      };
    }

    if (two_fa_settings?.enabled) {
      let continuation = await two_fa_challenge({
        req,
        profile: details,
        identity_settings,
        two_fa_settings,
        profile_type: profile_type_entry,
        meta_payload: { new_profile: newProfile, password },
        platform,
        otp_sub: `${profile_type}_signup`,
        template: {
          otp: "otp-2fa-signup",
          link: "link-2fa-signup",
        },
      });

      return !continuation?.ok
        ? continuation
        : {
            ok: true,
            status: 200,
            message: "2fa Initiated",
            data: {
              continuation_token: continuation.continuation_id,
              two_factor_auth: {
                type: continuation?.type,
              },
            },
          };
    }

    let Profile_passwords = await db.folder("Profile_passwords");

    await Profile_passwords.insertOne({
      _id: crypto.randomUUID(),
      profile: newProfile._id,
      key: hash(password),
      created: Date.now(),
    });
  }

  let res = await Profiles.insertOne(newProfile);

  if (!res.acknowledged) {
    return {
      ok: false,
      status: 500,
      message: "Failed to create profile",
    };
  }

  let welcome_notification = signup_settings?.notification;
  if (welcome_notification?.enabled) {
    await (
      await req.services("aimail")
    ).call("send_mail", {
      from: platform.name,
      to: newProfile.email,
      content: {
        template: welcome_notification?.template,
        params: { profile: newProfile },
      },
    });
  }

  let session_object = await create_session_object(newProfile, platform, req, {
    // meta_payload,
    session_settings: settings?.session,
    no_notify: true,
  });

  return {
    ok: true,
    status: 201,
    message: "Signup successful",
    data: newProfile,
    token: session_object?.token,
  };
};

const two_factor_signup = async (req) => {
  let { db, body, headers } = req;
  let { platform } = headers;
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
  let settings = await get_settings({
    req,
    body: {
      category: [platform._id],
      key: ["identity", "signup"],
    },
  });

  let identity_settings = settings?.identity;

  if (!identity_settings) {
    identity_settings = {
      uniques: ["email"],
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

  // Ensure all unique fields are present on the new profile
  let det = 0;
  for (let identity of identity_settings.uniques) {
    if (new_profile[identity]) det++;
  }
  if (!det) {
    return {
      ok: false,
      message: `Missing identity fields: ${identity_settings.uniques.join(",")}`,
    };
  }

  // Verify none of the unique identity values have been taken in the meantime
  const or = identity_settings.uniques
    .filter((field) => new_profile[field] !== undefined)
    .map((field) => ({
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
    await (
      await req.services("aimail")
    ).call(
      "send_mail",
      {
        from: platform.name,
        to: new_profile.email,
        content: {
          template: signup_setting?.notification?.template,
          params: {
            profile: new_profile,
            platform,
            profile_type: await (
              await db.folder("Profile_types")
            ).findOne({ _id: new_profile.profile }),
          },
        },
      },
      { profile: platform.profile },
    );
  }

  let session_object = await create_session_object(new_profile, platform, req, {
    // meta_payload,
    // session_settings: settings?.session,
    no_notify: true,
  });

  return {
    ok: true,
    status: 201,
    message: "Signup successful",
    token: session_object.token,
    data: new_profile,
  };
};

const forgot_password = async (req) => {
  let { db, body, headers } = req;
  let { platform } = headers;
  let { identity, profile_type } = body;

  let settings = await get_settings({
    req,
    body: { category: [platform._id], key: ["identity", "forgot_password"] },
  });

  let identity_settings = settings?.identity;

  if (!identity_settings) {
    return {
      ok: false,
      status: 400,
      message: "Invalid identity settings",
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
  for (let field of identity_settings?.uniques) {
    if (identity[field]) query[field] = identity[field];
  }

  if (Object.keys(query).length === 1) {
    return {
      ok: false,
      status: 400,
      message: `Missing identities field(s) of: ${identity_settings.uniques.join(",")}`,
    };
  }
  let Profiles = await db.folder("Profiles");
  let profile = await Profiles.findOne(query);
  if (!profile) {
    return { ok: false, status: 404, message: "Profile not found" };
  }

  let forgot_password_settings = settings?.forgot_password?.two_fa_settings;

  if (forgot_password_settings?.enabled) {
    let res = await two_fa_challenge({
      req,
      profile,
      two_fa_settings: forgot_password_settings,
      identity_settings,
      profile_type: await (
        await db.folder("Profile_types")
      ).findOne({ _id: profile_type }),
      platform,
      meta_payload: { profile_id: profile._id },
      otp_sub: `${profile_type}_forgot_password`,
      template: {
        otp: "otp_2fa_forgot_password",
        link: "link_2fa_forgot_password",
      },
    });

    return !res?.ok
      ? res
      : {
          ok: true,
          status: 200,
          message: "Forgot password 2fa initiated",
          data: {
            continuation_token: res.continuation_id,
            two_factor_auth: {
              type: res?.type,
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

const validate_continuation_token = async (req) => {
  let { db, body, headers } = req;
  let { platform } = headers;
  let { continuation_token, otp, sub_per, token, profile_type } = body;

  let sub = `${profile_type}_${sub_per}`;
  let validation = await validate_continuation(db, continuation_token, {
    otp,
    token,
    sub,
  });
  if (!validation.ok) {
    return validation;
  }

  let Validations = await db.folder("Validations");

  let v_token = crypto.randomUUID();
  await Validations.insertOne({
    _id: v_token,
    sub,
    continuation: validation.continuation,
  });
  return {
    ok: true,
    message: "Token validated",
    data: {
      sub,
      validation_token: v_token,
    },
  };
};

const reset_password = async (req) => {
  let { db, body, headers } = req;
  let { platform } = headers;
  let {
    continuation_token,
    validation_token,
    otp,
    token,
    profile_type,
    new_password,
  } = body;

  let validation = await validate_continuation(db, continuation_token, {
    otp,
    token,
    sub: `${profile_type}_forgot_password`,
    validation_token,
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

  let settings = await get_settings({
    req,
    body: { category: [platform._id], key: ["identity", "forgot_password"] },
  });

  let forgot_password_settings = settings?.forgot_password;

  if (forgot_password_settings?.notification?.enabled) {
    let Profiles = await db.folder("Profiles");
    let profile = await Profiles.findOne({
      _id: continuation.meta_payload.profile_id,
    });

    profile.email &&
      (await (
        await req.services("aimail")
      ).call(
        "send_mail",
        {
          from: platform.name,
          to: profile.email,
          content: {
            template:
              forgot_password_settings.notification.template ||
              "password_reset_successful",
            params: {
              profile,
              platform,
              profile_type: await (
                await db.folder("Profile_types")
              ).findOne({ _id: profile_type }),
            },
          },
        },
        { profile: platform.profile },
      ));
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

  let settings = await get_settings({
    req,
    body: {
      category: [profile.profile],
      key: ["identity"],
    },
  });

  let identity_settings = settings?.identity;

  const protected_fields = ["_id", "profile", "agent", "platform", "created"];

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
      )}. Use /update_profile_identity endpoint instead`,
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

  // Remove forbidden fields so callers cannot change core identifiers
  const forbiddenFields = ["_id", "profile", "agent", "created", "platform"];
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

  let settings = await get_settings({
    req,
    body: {
      category: [profile.profile],
      key: ["identity", "update_profile_identity"],
    },
  });

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

  let det = 0;
  for (let identity of identity_settings.uniques) {
    if (identity[identity]) det++;
  }
  if (!det) {
    return {
      ok: false,
      message: `Missing identity fields: ${identity_settings.uniques.join(",")}`,
    };
  }

  let Profiles = await db.folder("Profiles");

  const or = identity_settings.uniques
    .filter((field) => identity[field] !== undefined)
    .map((field) => ({
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
      profile_type: await (
        await db.folder("Profile_types")
      ).findOne({ _id: profile.profile }),
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

  let settings = await get_settings({
    req,
    body: {
      category: [profile.profile],
      key: ["identity"],
    },
  });

  let identity_settings = settings?.identity;

  const identity = continuation.meta_payload.identity;

  const or = identity_settings.uniques
    .filter((field) => identity[field] !== undefined)
    .map((field) => ({
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

const signout = async (req) => {
  let { headers, db } = req;

  let author = headers["Authorization"];
  author = author && author.replace(`Bearer `, "");

  let Sessions = await db.folder("Sessions");
  await Sessions.deleteOne({ token: author });

  return {
    ok: true,
    message: "Sign out successful",
  };
};

const reset_password_by_old_password = async (req) => {
  let { headers, db, body } = req;

  let { profile } = headers;
  let { old_password, new_password } = body;

  let Profile_passwords = await db.folder("Profile_passwords");

  let prev_pass = await Profile_passwords.findOne({ profile: profile._id });
  if (old_password && hash(old_password) !== prev_pass?.key) {
    return {
      ok: false,
      status: 403,
      message: "Old password is not correct.",
    };
  }

  let pass_id = crypto.randomUUID();
  await Profile_passwords.updateOne(
    { _id: prev_pass?._id || pass_id },
    {
      $set: {
        key: hash(new_password),
      },
      $setOnInsert: {
        _id: pass_id,
        created: Date.now(),
        profile: profile._id,
      },
    },
    {
      upsert: true,
    },
  );

  return {
    ok: true,
    message: "Password updated successfully",
  };
};

export {
  signin,
  signup,
  signout,
  reset_password_by_old_password,
  two_factor_signin,
  two_factor_signup,
  forgot_password,
  reset_password,
  refresh_token,
  update_profile,
  update_profile_identity,
  confirm_update_profile_identity,
  validate_continuation_token,
  //
  get_platform_profile,
};
