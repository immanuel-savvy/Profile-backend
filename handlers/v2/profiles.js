import {
  OTPS,
  PASSWORDS,
  PENDING_PROFILES,
  PROFILES,
  RESET_TOKENS,
  SESSIONS,
  USERS,
} from "../../ds/folders.js";
import { hash } from "../../utils/hash.js";
import crypto from "crypto";
import { generate_otp, OTP_expiry, send_mail } from "./platform.js";
import { email_service, settings_service } from "../../services/email.js";

const get_platform_profile = async (platform) => {
  let profile = await (await PROFILES()).findOne({ _id: platform._id });

  return profile;
};

const service_auth = async (profile, uri) => {
  if (!profile?.platform) profile = await get_platform_profile(profile);

  let platform = await (await USERS()).findOne({ uri });

  let sess = await (
    await SESSIONS()
  ).findOne({
    platform: platform._id,
    platform_profile: profile._id,
    third_party_platform: profile.platform,
  });

  return sess?.token;
};

const retrieve_setting = async (profile, body) => {
  let auth = await service_auth(profile, "settings.savvyaisolution.com");
  if (!auth) return;

  try {
    let response = await fetch(`${settings_service}/get_setting`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-version": "v1",
        "x-platform": `profile.savvyaisolution.com`,
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify(body || {}),
    });

    response = await response.json();

    console.log(response, "HIII");
    return response?.ok ? response?.data : undefined;
  } catch (err) {
    console.error(err);
  }
};

export { service_auth };

const send_message = async (
  { phone, content, category, template },
  profile,
) => {
  let auth = await service_auth(profile, "aimail.savvyaisolution.com");

  if (!auth) return;

  try {
    let response = await fetch(`${email_service}/send_message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-version": "v2",
        "x-platform": `profile.savvyaisolution.com`,
        Authorization: `Bearer ${auth}`,
      },
      body: JSON.stringify({ phone, category, content, template }),
    });

    response = await response.json();

    return response;
  } catch (err) {
    console.error(err);
  }
};

const create_profile = async ({ platform, details, type }) => {
  let setting = await retrieve_setting(platform);

  let uids = setting?.identity?.unique_ids || {
    properties: ["email"],
    query: "and",
  };

  if (!uids || !uids.properties?.length) {
    uids = { properties: ["email"], query: "and" };
  }

  // 🔑 Build query
  const conditions = uids.properties
    .filter((key) => details[key] !== undefined)
    .map((key) => ({ [key]: details[key] }));

  let query = {};
  if (conditions.length) {
    query = uids.query === "or" ? { $or: conditions } : { $and: conditions };
  }

  query.profile = type;

  const Profiles = await PROFILES();

  // 🚨 Check existing
  const exist = conditions.length ? await Profiles.findOne(query) : null;

  if (exist) {
    return {
      ok: false,
      message: "Profile with provided unique fields already exists",
    };
  }

  let Pending = await PENDING_PROFILES();

  // 🔑 Build filter
  let filter = {};
  if (conditions.length) {
    filter = uids.query === "or" ? { $or: conditions } : { $and: conditions };
  } else {
    filter = { _id: crypto.randomUUID() };
  }

  filter.profile = type;

  // 🔄 Upsert pending profile
  const result = await Pending.findOneAndUpdate(
    filter,
    {
      $set: {
        ...details,
        platform: platform._id,
        updated: new Date(),
      },
      $setOnInsert: {
        profile: type,
        _id: crypto.randomUUID(),
        created: new Date(),
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  const profile_details = result.value || result;

  let verification_setting = setting?.verification;

  // 🔐 Generate OTP
  let otp_conf = {
    expiry: verification_setting?.otp?.expiry || OTP_expiry,
    length: verification_setting?.otp?.length || 6,
  };
  const otp = await generate_otp([profile_details.email], type, otp_conf);

  let template = verification_setting?.template || "signup_otp";
  // 📧 Email
  if (uids.properties.includes("email") && details.email) {
    await send_mail(
      {
        from: { name: platform.name },
        to: details.email,
        content: {
          template,
          category: "verification",
          variables: {
            profile: { name: profile_details.fullname },
            platform,
            otp: { code: otp, expiry: otp_conf.expiry },
          },
        },
      },
      await get_platform_profile(platform),
    );
  }

  // 📱 SMS
  if (uids.properties.includes("phone") && details.phone) {
    await send_message(
      {
        phone: details.phone,
        template,
        category: "verification",
        content: {
          profile: { name: profile_details.fullname },
          platform,
          otp: { code: otp, expiry: otp_conf.expiry },
        },
      },
      await get_platform_profile(platform),
    );
  }

  return {
    ok: true,
    message: "Pls verify profile",
    data: profile_details,
  };
};

const add_profile = async (req) => {
  const platform = req.headers.platform;
  const { details, profile: type } = req.body;

  const response = await create_profile({
    platform,
    details,
    type,
  });

  return response;
};

const verify_profile = async (req) => {
  let platform = req.headers.platform;
  let { code, email, phone, profile } = req.body;

  let Otps = await OTPS(profile);

  // 🔍 Find OTP
  let identifiers = [email, phone].filter(Boolean);

  let otpRecord = await Otps.findOne({
    id: { $in: identifiers },
  });

  if (!otpRecord) {
    return {
      ok: false,
      message: "Invalid OTP or identity",
    };
  }

  console.log(otpRecord, code, "UHH");
  if (otpRecord.code !== code) {
    return {
      ok: false,
      message: "OTP does not match",
    };
  }

  console.log(
    new Date(otpRecord.updatedAt).getTime() + otpRecord.expiry * 1000 * 60,
    "expiry time",
    otpRecord,
  );

  // ⏳ Expiry
  if (
    new Date(otpRecord.updatedAt).getTime() + otpRecord.expiry * 1000 * 60 <
    Date.now()
  ) {
    return {
      ok: false,
      message: "OTP has expired",
    };
  }

  let Pending = await PENDING_PROFILES();
  let Profiles = await PROFILES();
  let Passwords = await PASSWORDS();

  let pendingProfile = await Pending.findOne({
    profile,
    ...(email && { email }),
    ...(phone && { phone }),
  });

  if (!pendingProfile) {
    return {
      ok: false,
      message: "Pending profile not found",
    };
  }

  // 🔐 Extract & hash password
  let rawPassword = pendingProfile.password;

  if (!rawPassword) {
    return {
      ok: false,
      message: "Password not found in pending profile",
    };
  }

  const hashed = hash(rawPassword);

  // 🧾 Store password separately
  await Passwords.updateOne(
    { _id: pendingProfile._id },
    {
      $set: {
        key: hashed,
        updated: new Date(),
      },
      $setOnInsert: {
        _id: pendingProfile._id,
        created: new Date(),
      },
    },
    { upsert: true },
  );

  // ❌ Remove password from profile
  delete pendingProfile.password;

  // ✅ Create final profile
  let finalProfile = {
    ...pendingProfile,
    verified: true,
    verifiedAt: new Date(),
  };

  await Profiles.insertOne(finalProfile);

  // 🧹 Cleanup
  await Pending.deleteOne({ _id: pendingProfile._id });
  await Otps.deleteOne({ _id: otpRecord._id });

  if (finalProfile?.email)
    await send_mail(
      {
        from: { name: platform.name },
        to: finalProfile.email,
        content: {
          template: "welcome",
          category: "onboarding",
          variables: {
            profile: finalProfile,
            platform,
          },
        },
      },
      await get_platform_profile(platform),
    );

  return {
    ok: true,
    message: "Profile verified successfully",
    data: finalProfile,
  };
};

const signin_user = async ({
  platform,
  body,
  platform_profile,
  third_party_platform,
}) => {
  let setting = await retrieve_setting(platform);

  let uids = setting?.identity?.unique_ids || {
    properties: ["email"],
    query: "and",
  };

  // 🔑 Build query
  const conditions = uids.properties
    .filter((key) => body[key] !== undefined)
    .map((key) => ({ [key]: body[key] }));

  if (!conditions.length) {
    return { ok: false, message: "Missing credentials" };
  }

  let query = uids.query === "or" ? { $or: conditions } : { $and: conditions };

  query.profile = body.profile;

  const Profiles = await PROFILES();

  const user = await Profiles.findOne(query);

  if (!user) {
    return { ok: false, message: "Invalid credentials" };
  }

  let pass = await (await PASSWORDS()).findOne({ _id: user._id });

  if (!pass) {
    return { ok: false, message: "Password not set" };
  }

  let isMatch = hash(body.password) === pass.key;

  if (!isMatch) {
    return { ok: false, message: "Incorrect Password" };
  }

  // 🔐 Check 2FA
  let profile_setting = await retrieve_setting(user);

  const requires2FA = profile_setting?.two_factor_auth;

  if (setting?.two_factor_auth?.force_enable || requires2FA?.enabled) {
    const identifiers = [user.email, user.phone].filter(Boolean);

    const otp = await generate_otp(
      identifiers,
      body.profile,
      setting.two_factor_auth.otp,
    );

    let template = setting?.two_factor_auth?.template || "two_factor_auth_otp";

    if (user.email) {
      await send_mail(
        {
          from: { name: platform.name },
          to: user.email,
          content: {
            template,
            category: "verification",
            variables: {
              profile: {
                ...user,
              },
              platform,
              otp: {
                code: otp,
                expiry: setting?.two_factor_auth?.otp?.expiry || OTP_expiry,
              },
            },
          },
        },
        await get_platform_profile(platform),
      );
    }

    if (user.phone) {
      await send_message(
        {
          phone: user.phone,
          template,
          category: "verification",
          content: {
            profile: user,
            platform,
            otp: {
              code: otp,
              expiry_time: setting?.two_factor_auth?.otp?.expiry || OTP_expiry,
            },
          },
        },
        platform,
      );
    }

    return {
      ok: true,
      message: "OTP sent for two factor authentication",
      requires_2fa: true,
      data: { email: user.email },
    };
  }

  // 🔐 Create session
  const token = crypto.randomBytes(32).toString("hex");

  const Sessions = await SESSIONS();

  let sess = {
    _id: crypto.randomUUID(),
    token,
    user: user._id,
    platform: platform._id,
    profile: user.profile,
    platform_profile,
    created: new Date(),
  };
  if (third_party_platform)
    sess.third_party_platform = third_party_platform?._id;
  await Sessions.insertOne(sess);

  return {
    ok: true,
    message: "Signin successful",
    token,
    data: user,
  };
};

const signin = async (req) => {
  const platform = req.headers.platform;
  const body = req.body;

  const response = await signin_user({ platform, body });

  return response;
};

const profile_two_factor_auth = async (req) => {
  let platform = req.headers.platform;
  let { email, phone, code, profile } = req.body;

  let collection = await OTPS(profile);

  let identifiers = [email, phone].filter(Boolean);

  // 🔎 Find OTP
  let otp = await collection.findOne({
    id: { $in: identifiers },
  });

  if (!otp) {
    return {
      ok: false,
      message: "OTP not found",
    };
  }

  if (otp.code !== code) {
    return {
      ok: false,
      message: "OTP does not match",
    };
  }

  // ⏳ Check expiry
  if (new Date(otp.updatedAt).getTime() + otp.expiry * 1000 * 60 < Date.now()) {
    return {
      ok: false,
      message: "OTP has expired",
    };
  }

  // 🔑 Rebuild user lookup using uids
  let setting = await retrieve_setting(platform);

  let uids = setting?.identity?.unique_ids || {
    properties: ["email"],
    query: "and",
  };

  const conditions = uids.properties
    .filter((key) => ({ email, phone })[key] !== undefined)
    .map((key) => ({ [key]: { email, phone }[key] }));

  let query = uids.query === "or" ? { $or: conditions } : { $and: conditions };

  query.profile = profile;

  let user = await (await PROFILES()).findOne(query);

  if (!user) {
    return {
      ok: false,
      message: "User not found",
    };
  }

  // 🔐 Generate session token
  const token = generate_token();

  const Sessions = await SESSIONS();

  await Sessions.insertOne({
    _id: crypto.randomUUID(),
    token,
    user: user._id,
    platform: platform._id,
    profile,
    created: new Date(),
  });

  // 🧹 Cleanup OTP
  await collection.deleteOne({ _id: otp._id });

  return {
    ok: true,
    message: "Two factor authentication successful",
    token,
    data: user,
  };
};

const resend_profile_otp = async (req) => {
  let platform = req.headers.platform;
  let { email, phone, profile, kind } = req.body;
  kind = kind || "vrf";

  let setting = await retrieve_setting(platform);

  let uids = setting?.identity?.unique_ids || {
    properties: ["email"],
    query: "and",
  };

  // 🔑 Build query
  const conditions = uids.properties
    .filter((key) => ({ email, phone })[key] !== undefined)
    .map((key) => ({ [key]: { email, phone }[key] }));

  if (!conditions.length) {
    return {
      ok: false,
      message: "No identity provided",
    };
  }

  let query = uids.query === "or" ? { $or: conditions } : { $and: conditions };

  query.profile = profile;

  let user = await (await PROFILES()).findOne(query);
  if (!user && kind === "vrf") {
    user = await (await PENDING_PROFILES()).findOne({ email, profile });
  }

  if (!user) {
    return {
      ok: false,
      message: "User not found",
    };
  }

  let conf =
    setting?.[
      kind === "upd"
        ? "update_verification"
        : kind === "2fa"
          ? "two_factor_auth"
          : kind === "psk"
            ? "forgot_password"
            : "verification"
    ] || {};

  if (conf?.mode === "link") {
    const resetToken = crypto.randomBytes(32).toString("hex");
    await (
      await RESET_TOKENS()
    ).insertOne({
      _id: crypto.randomUUID(),
      user: user._id,
      token: resetToken,
      expiry: conf.reset.expiry || OTP_expiry,
      platform: platform._id,
      profile,
      created: new Date(),
    });

    let template = conf.template.link;

    // 📧 Send email
    if (uids?.properties?.includes("email") && user.email) {
      await send_mail(
        {
          from: { name: platform.name },
          to: user.email,
          content: {
            template,
            category: "verification",
            variables: {
              profile: user,
              platform,
              reset: {
                link: `${conf?.reset?.url}?token=${resetToken}`,
                expiry: conf.reset?.expiry || OTP_expiry,
              },
            },
          },
        },
        await get_platform_profile(platform),
      );
    }

    // 📱 Send SMS
    if (uids?.properties?.includes("phone") && user.phone) {
      await send_message(
        {
          phone: user.phone,
          template,
          category: "verification",
          content: {
            profile: user,
            platform,
            reset: {
              link: `${conf?.reset?.url}?token=${resetToken}`,
              expiry: conf.reset?.expiry || OTP_expiry,
            },
          },
        },
        await get_platform_profile(platform),
      );
    }
  } else {
    let otp;

    otp = await generate_otp(
      [user.email, user.phone],
      profile,
      conf.otp || {
        expiry: OTP_expiry,
        length: 6,
      },
    );

    let template =
      (typeof conf.template === "string"
        ? conf.template
        : conf.template?.[conf.mode]) || "signup_otp";

    // 📧 Send email
    if (uids?.properties?.includes("email") && user.email) {
      await send_mail(
        {
          from: { name: platform.name },
          to: user.email,
          content: {
            template,
            category: "verification",
            variables: {
              profile: user,
              platform,
              otp: { code: otp, expiry: conf?.otp?.expiry || OTP_expiry },
            },
          },
        },
        await get_platform_profile(platform),
      );
    }

    // 📱 Send SMS
    if (uids?.properties?.includes("phone") && user.phone) {
      await send_message(
        {
          phone: user.phone,
          template,
          category: "verification",
          content: {
            profile: user,
            platform,
            otp: { code: otp, expiry: conf?.otp?.expiry || OTP_expiry },
          },
        },
        await get_platform_profile(platform),
      );
    }
  }

  return {
    ok: true,
    message: "OTP resent for verification",
    data: { email: user.email },
  };
};

const profile_forgot_password = async (req) => {
  let platform = req.headers.platform;
  let { email, phone, profile } = req.body;

  let setting = await retrieve_setting(platform);

  let uids = setting?.identity?.unique_ids || {
    properties: ["email"],
    query: "and",
  };

  // 🔑 Build query
  const conditions = uids.properties
    .filter((key) => ({ email, phone })[key] !== undefined)
    .map((key) => ({ [key]: { email, phone }[key] }));

  if (!conditions.length) {
    return {
      ok: false,
      message: "No identity provided",
    };
  }

  let query = uids.query === "or" ? { $or: conditions } : { $and: conditions };

  query.profile = profile;

  let user = await (await PROFILES()).findOne(query);

  if (!user) {
    return {
      ok: false,
      message: "User not found",
    };
  }

  let settings = await retrieve_setting(platform);
  let reset_password_setting = settings?.forgot_password;

  if (reset_password_setting?.mode === "link") {
    // 🔐 Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    await (
      await RESET_TOKENS()
    ).insertOne({
      _id: crypto.randomUUID(),
      user: user._id,
      token: resetToken,
      expiry: reset_password_setting.reset?.expiry || OTP_expiry,
      platform: platform._id,
      profile,
      created: new Date(),
    });

    let template =
      reset_password_setting?.template?.link || "forgot_password_link";

    // 📧 Send email
    if (uids?.properties?.includes("email") && user.email) {
      await send_mail(
        {
          from: { name: platform.name },
          to: user.email,
          content: {
            template,
            category: "verification",
            variables: {
              profile: user,
              platform,
              reset: {
                link: `${reset_password_setting?.reset?.url}?token=${resetToken}`,
                expiry: reset_password_setting?.reset?.expiry,
              },
            },
          },
        },
        await get_platform_profile(platform),
      );
    }

    // 📱 Send SMS
    if (uids?.properties?.includes("phone") && user.phone) {
      await send_message(
        {
          phone: user.phone,
          template,
          category: "verification",
          content: {
            profile: user,
            platform,
            reset: {
              link: `${reset_password_setting?.reset?.url}?token=${resetToken}`,
              expiry: reset_password_setting?.reset?.expiry,
            },
          },
        },
        await get_platform_profile(platform),
      );
    }

    return {
      ok: true,
      message: "Password reset link sent",
      data: {
        email: user.email,
        reset_link: `${reset_password_setting?.reset_password_url}?token=${resetToken}`,
      },
    };
  } else {
    // 🔐 Generate OTP
    const otp = await generate_otp([user.email, user.phone], profile, {
      expiry: reset_password_setting?.otp?.expiry || OTP_expiry,
      length: reset_password_setting?.otp?.length,
    });

    let template =
      reset_password_setting?.template?.otp || "forgot_password_otp";

    // 📧 Send email
    if (user.email) {
      await send_mail(
        {
          from: { name: platform.name },
          to: user.email,
          content: {
            template,
            category: "verification",
            variables: {
              profile: user,
              platform,
              otp: {
                code: otp,
                expiry: reset_password_setting?.otp?.expiry || OTP_expiry,
              },
            },
          },
        },
        await get_platform_profile(platform),
      );
    }

    // 📱 Send SMS
    if (user.phone) {
      await send_message(
        {
          phone: user.phone,
          template,
          category: "verification",
          content: {
            profile: user,
            platform,
            otp: {
              code: otp,
              expiry: reset_password_setting?.otp?.expiry || OTP_expiry,
            },
          },
        },
        await get_platform_profile(platform),
      );
    }

    return {
      ok: true,
      message: "OTP sent for password reset",
      data: { email: user.email },
    };
  }
};

const profile_verify_forgot_password = async (req) => {
  let platform = req.headers.platform;
  let { email, phone, code, token, profile, new_password } = req.body;

  /**
   * =========================
   * TOKEN RESET FLOW
   * =========================
   */
  if (token) {
    let rest = await (await RESET_TOKENS()).findOne({ token });
    if (!rest) {
      return {
        ok: false,
        message: "Invalid reset token",
      };
    }

    if (
      new Date(rest.updatedAt).getTime() + rest.expiry * 1000 * 60 <
      Date.now()
    ) {
      return {
        ok: false,
        message: "Reset token has expired",
      };
    }

    await (
      await PASSWORDS()
    ).updateOne(
      { _id: rest.user },
      { $set: { key: hash(new_password), updated: new Date() } },
      { upsert: true },
    );

    let prof = await (await PROFILES()).findOne({ _id: rest.user });

    if (prof?.email)
      await send_mail(
        {
          from: { name: platform.name },
          to: prof.email,
          content: {
            template: "password_updated",
            category: "security",
            variables: {
              profile: prof,
              platform,
              time: new Date().toISOString(),
            },
          },
        },
        await get_platform_profile(platform),
      );

    return {
      ok: true,
      message: "Password reset successful",
    };
  }

  /**
   * =========================
   * OTP FLOW
   * =========================
   */

  let collection = await OTPS(profile);
  let identifiers = [email, phone].filter(Boolean);

  let otp = await collection.findOne({
    id: { $in: identifiers },
  });

  if (!otp) {
    return {
      ok: false,
      message: "OTP not found",
    };
  }

  if (otp.code !== code) {
    return {
      ok: false,
      message: "OTP does not match",
    };
  }

  if (new Date(otp.updatedAt).getTime() + otp.expiry * 1000 * 60 < Date.now()) {
    return {
      ok: false,
      message: "OTP has expired",
    };
  }

  /**
   * =========================
   * USER LOOKUP
   * =========================
   */

  let setting = await retrieve_setting(platform);

  let uids = setting?.identity?.unique_ids || {
    properties: ["email"],
    query: "and",
  };

  const conditions = uids.properties
    .filter((key) => ({ email, phone })[key] !== undefined)
    .map((key) => ({ [key]: { email, phone }[key] }));

  let query = uids.query === "or" ? { $or: conditions } : { $and: conditions };

  query.platform = platform._id;
  query.profile = profile;

  let user = await (await PROFILES()).findOne(query);

  if (!user) {
    return {
      ok: false,
      message: "User not found",
    };
  }

  /**
   * =========================
   * PASSWORD UPDATE
   * =========================
   */

  const newHash = hash(new_password);

  await (
    await PASSWORDS()
  ).updateOne(
    { _id: user._id },
    {
      $set: {
        key: newHash,
        updated: new Date(),
      },
    },
    { upsert: true },
  );

  /**
   * =========================
   * CLEANUP OTP
   * =========================
   */

  await collection.deleteOne({ _id: otp._id });

  /**
   * =========================
   * EMAIL NOTIFICATION (NEW)
   * =========================
   */

  if (user.email) {
    await send_mail(
      {
        from: { name: platform.name },
        to: user.email,
        content: {
          template: "password_updated",
          category: "security",
          variables: {
            profile: user,
            platform,
            time: new Date().toISOString(),
          },
        },
      },
      await get_platform_profile(platform),
    );
  }

  return {
    ok: true,
    message: "Password reset successful",
  };
};

const update_profile = async (req) => {
  let platform = req.headers.platform;
  let profile_data = req.headers.profile;
  let { updates } = req.body;

  let profile = profile_data?._id;

  if (!profile || !updates || typeof updates !== "object") {
    return {
      ok: false,
      message: "Malformed body",
    };
  }

  let Profiles = await PROFILES();

  if (!profile_data) {
    return {
      ok: false,
      message: "Profile is not found.",
    };
  }

  let settings = await retrieve_setting(platform, {
    category: "identity",
    value: "unique_ids",
  });

  let uids = settings?.identity?.unique_ids || {
    properties: ["email"],
    query: "and",
  };

  const attempting = uids.properties.filter((p) =>
    Object.prototype.hasOwnProperty.call(updates, p),
  );

  if (attempting.length) {
    return {
      ok: false,
      status: 403,
      message:
        "Unique identity fields cannot be updated via this endpoint; please use the update profile unique endpoint instead.",
      data: { fields: attempting },
    };
  }

  const result = await Profiles.findOneAndUpdate(
    { _id: profile },
    { $set: updates, $currentDate: { updated: true } },
    { returnDocument: "after" },
  );

  const updatedProfile =
    result?.value || (await Profiles.findOne({ _id: profile }));

  ({
    ok: true,
    message: "Profile updated successfully.",
    data: updatedProfile,
  });
};

const update_profile_unique = async (req) => {
  let { platform, profile: profile_data } = req.headers;
  let { unique, value } = req.body;

  if (!profile_data) {
    return {
      ok: false,
      message: "Profile is not found.",
    };
  }

  let settings = await retrieve_setting(platform, {
    category: "update_verification",
  });

  let otp = await generate_otp(
    [profile_data._id],
    profile_data.profile,
    settings?.update_verification?.otp || {
      expiry: OTP_expiry,
      length: 6,
      meta: { type: "update_unique", field: unique, value },
    },
  );

  if (unique === "email") {
    await send_mail(
      {
        from: { name: platform.name },
        to: value,
        content: {
          template: "update_email",
          category: "verification",
          variables: {
            profile: profile_data,
            platform,
            otp: {
              code: otp,
              expiry: settings?.update_verification?.otp?.expiry || OTP_expiry,
            },
          },
        },
      },
      await get_platform_profile(platform),
    );

    ({
      ok: true,
      message: "Email updated successfully.",
    });
  } else if (unique === "phone") {
    await send_message(
      {
        phone: value,
        template: "update_phone",
        category: "verification",
        content: {
          profile: profile_data,
          platform,
          otp: {
            code: otp,
            expiry: settings?.update_verification?.otp?.expiry || OTP_expiry,
          },
        },
      },
      await get_platform_profile(platform),
    );

    ({
      ok: true,
      message: "Phone updated successfully.",
    });
  } else {
    ({
      ok: false,
      message: "Unsupported unique field.",
    });
  }
};

const validate_update_profile_unique = async (req) => {
  let { profile: profile_data } = req.headers;
  let { code } = req.body;
  let profile = profile_data?._id;

  let Profiles = await PROFILES();

  if (!profile_data) {
    return {
      ok: false,
      message: "Profile is not found.",
    };
  }

  let collection = await OTPS(profile_data.profile);
  let otp = await collection.findOne({
    id: { $in: [profile_data._id] },
  });
  if (!otp) {
    return {
      ok: false,
      message: "OTP not found",
    };
  }

  if (otp.code !== code) {
    return {
      ok: false,
      message: "OTP does not match",
    };
  }

  if (new Date(otp.updatedAt).getTime() + otp.expiry * 1000 * 60 < Date.now()) {
    return {
      ok: false,
      message: "OTP has expired",
    };
  }

  let updates = {};
  updates[otp.meta.field] = otp.meta.value;

  const result = await Profiles.findOneAndUpdate(
    { _id: profile },
    { $set: updates, $currentDate: { updated: true } },
    { returnDocument: "after" },
  );

  const updatedProfile =
    result?.value || (await Profiles.findOne({ _id: profile }));

  await collection.deleteOne({ _id: otp._id });

  ({
    ok: true,
    message: "Profile updated successfully.",
    data: updatedProfile,
  });
};

export {
  add_profile,
  retrieve_setting,
  update_profile,
  update_profile_unique,
  signin,
  verify_profile,
  validate_update_profile_unique,
  profile_two_factor_auth,
  profile_forgot_password,
  profile_verify_forgot_password,
  resend_profile_otp,
  create_profile,
  signin_user,
};
