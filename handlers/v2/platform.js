import crypto from "crypto";
import { hash } from "../../utils/hash.js";
import { retrieve_setting } from "./profiles.js";

let Platform_profile_type_id = "platform_profile_type_id"; // profile type id for platforms

export { Platform_profile_type_id };

const send_mail = async ({ from, to, content }, profile, req) => {
  if (content?.variables?.profile) {
    let profile = content.variables.profile;
    content.variables.profile = {
      ...profile,
      name: `${profile.name || profile.fullname || `${profile.firstname} ${profile.lastname}`.trim()}`,
    };
  }

  console.log(req);
  let email_service = await req.services("aimail");
  console.log(email_service, "uhh");
  let response = email_service.call(
    "send_mail",
    {
      from,
      to,
      content,
    },
    { profile: profile._id },
  );

  return response;
};

const generate_otp = async (id, sub, opts = {}) => {
  let { expiry = 5, length = 6, meta, req } = opts || {};

  const collection = await req.db.folder(`OTPS:${sub || "general"}`);

  // Ensure valid length
  if (length < 1) throw new Error("OTP length must be at least 1");

  // Generate min and max dynamically
  const min = 10 ** (length - 1);
  const max = 10 ** length;

  const code = crypto.randomInt(min, max).toString();

  await collection.updateOne(
    { id },
    {
      $set: {
        code,
        expiry,
        meta,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  return code;
};

const OTP_expiry = 5;

const add_platform = async (req) => {
  let { email, name, password } = req.body;
  let db = req.db;

  const Users = await db.folder("Users");
  const Pending = await db.folder("Pending_users");

  // Normalize inputs
  const cleanName = name.replace(/\s+/g, "").toLowerCase();
  const emailDomain = email.split("@")[1].toLowerCase();

  // Create URI
  const uri = `${cleanName}.${emailDomain}`;

  // Check existing
  let exist = await Users.findOne({
    $or: [{ email }, { name }],
  });

  console.log(exist, req.body, "newplatform bdy");
  if (exist) {
    let msg;

    if (email === exist.email && name === exist.name) {
      msg = "Email and Name have already been used";
    } else if (email === exist.email) {
      msg = "Email has already been used";
    } else if (name === exist.name) {
      msg = "Name has already been used";
    }

    return {
      ok: false,
      message: msg,
    };
  }

  // Hash password
  const hashedPassword = hash(password);

  // Upsert pending user
  await Pending.updateOne(
    { email, name },
    {
      $set: {
        name,
        email,
        uri, // ✅ added here
        password: hashedPassword,
        updated: new Date(),
      },
      $setOnInsert: {
        _id: crypto.randomUUID(),
        created: new Date(),
      },
    },
    { upsert: true },
  );

  // Generate OTP

  const otp = await generate_otp(email, null, { req });

  // Send mail
  const mail_res = await send_mail(
    {
      from: { name: "Profile" },
      to: email,
      content: {
        template: "signup_otp",
        category: "verification",
        variables: {
          profile: { name },
          otp: {
            code: otp,
            expiry: OTP_expiry,
          },
        },
      },
    },
    await (
      await db.folder("profiles")
    ).findOne({
      _id: process.env.PROFILE_ID,
    }),
    req,
  );

  return {
    ok: mail_res.ok || false,
    message: mail_res.ok
      ? "OTP sent to your email. Verify to continue."
      : mail_res.message || "Failed to send OTP email",
    data: { email, name, uri }, // ✅ return it too
  };
};

const verify_platform = async (req) => {
  let { email, code } = req.body;

  let db = req.db;
  let collection = await db.folder("OTPS:general");
  let otp = await collection.findOne({ id: email });

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

  if (new Date(otp.updatedAt).getTime() + OTP_expiry * 1000 * 60 < Date.now()) {
    return {
      ok: false,
      message: "OTP have expired",
    };
  }

  let Pending = await db.folder("Pending_users");
  let platform = await Pending.findOne({ email });

  let pass = platform.password;
  delete platform.password;

  await (await db.folder("Users")).insertOne(platform);
  let platform_profile = {
    ...platform,
    profile: Platform_profile_type_id,
    platform: "usr_profile_001",
  };
  delete platform_profile.uri;
  await (await db.folder("profiles")).insertOne(platform_profile);
  await (
    await db.folder("Passwords")
  ).insertOne({ _id: platform._id, key: pass });

  await (
    await db.folder("Tokens")
  ).insertOne({
    _id: crypto.randomUUID(),
    user: platform._id,
    token: crypto.randomBytes(32).toString("hex"),
  });

  await send_mail(
    {
      from: { name: "Profile" },
      to: platform.email,
      content: {
        template: "welcome",
        category: "onboarding",
        variables: {
          profile: platform,
        },
      },
    },
    await (
      await db.folder("profiles")
    ).findOne({ _id: process.env.PROFILE_ID }),
    req,
  );

  return {
    ok: true,
    message: "Platform verified",
    data: platform,
  };
};

const resend_verification_otp = async (req) => {
  let { email } = req.body;
  let db = req.db;

  let Pending = await db.folder("Pending_users");
  let platform = await Pending.findOne({ email });

  if (!platform) {
    return {
      ok: false,
      message: "Platform not found",
    };
  }

  const otp = await generate_otp(email, null, { req });

  const mail_res = await send_mail(
    {
      from: { name: "Profile" },
      to: email,
      content: {
        template: "signup_otp",
        category: "verification",
        variables: {
          profile: { name: platform.name },
          otp: {
            code: otp,
            expiry: OTP_expiry,
          },
        },
      },
    },
    await (
      await db.folder("profiles")
    ).findOne({ _id: process.env.PROFILE_ID }),
    req,
  );

  return {
    ok: mail_res.ok || false,
    message: mail_res.ok
      ? "OTP resent to your email. Verify to continue."
      : mail_res.message || "Failed to resend OTP email",
  };
};

const forgot_password = async (req) => {
  let { email } = req.body;
  let db = req.db;

  let user = await (await db.folder("Users")).findOne({ email });

  if (!user) {
    return {
      ok: false,
      message: "Platform not found",
    };
  }

  const otp = await generate_otp(email, null, { req });

  const mail_res = await send_mail(
    {
      from: { name: "Profile" },
      to: email,
      content: {
        template: "forgot_password_otp",
        category: "verification",
        variables: {
          profile: { name: user.name },
          otp: {
            code: otp,
            expiry: OTP_expiry,
          },
        },
      },
    },
    await (
      await db.folder("profiles")
    ).findOne({ _id: process.env.PROFILE_ID }),
    req,
  );

  return {
    ok: mail_res.ok || false,
    message: mail_res.ok
      ? "OTP sent to your email. Verify to continue."
      : mail_res.message || "Failed to send OTP email",
  };
};

const verify_forgot_password_otp = async (req) => {
  let { email, code, new_password } = req.body;
  let db = req.db;

  let collection = await db.folder("OTPS:general");
  let otp = await collection.findOne({ id: email });

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

  if (new Date(otp.updatedAt).getTime() + OTP_expiry * 1000 * 60 < Date.now()) {
    return {
      ok: false,
      message: "OTP have expired",
    };
  }

  let user = await (await db.folder("Users")).findOne({ email });

  if (!user) {
    return {
      ok: false,
      message: "Platform not found",
    };
  }

  const hashedPassword = hash(new_password);

  await (
    await db.folder("Passwords")
  ).updateOne({ _id: user._id }, { $set: { key: hashedPassword } });

  await send_mail(
    {
      from: { name: "Profile" },
      to: email,
      content: {
        template: "password_updated",
        category: "security",
        variables: {
          profile: { name: user.name },
        },
      },
    },
    await (
      await db.folder("profiles")
    ).findOne({ _id: process.env.PROFILE_ID }),
    req,
  );

  return {
    ok: true,
    message: "Password updated successfully",
  };
};

const login_platform = async (req) => {
  let { email, password } = req.body;
  let db = req.db;

  let user = await (await db.folder("Users")).findOne({ email });

  if (!user) {
    return {
      ok: false,
      message: "Platform not found",
    };
  }

  let pass = await (await db.folder("Passwords")).findOne({ _id: user._id });

  if (pass.key !== hash(password)) {
    return {
      ok: false,
      message: "Incorrect password",
    };
  }

  let setting = await retrieve_setting(user, null, { req });

  let two_fa_setting = setting?.two_factor_auth;
  if (two_fa_setting?.enabled) {
    // Generate OTP
    const otp = await generate_otp(email, "two_factor_auth", {
      ...two_fa_setting?.otp,
      req,
    });

    // Send mail
    let response = await send_mail(
      {
        from: { name: "Profile" },
        to: email,
        content: {
          template: two_fa_setting?.template || "two_factor_auth_otp",
          category: "verification",
          variables: {
            profile: { name: user.name },
            otp: {
              code: otp,
              expiry: two_fa_setting.otp?.expiry || OTP_expiry,
            },
          },
        },
      },
      await (
        await db.folder("profiles")
      ).findOne({ _id: process.env.PROFILE_ID }),
      req,
    );

    return {
      ok: !!response?.ok,
      message: !!response?.ok
        ? "OTP sent to your email. Verify to continue."
        : response?.message,
      data: { two_factor_auth: true, email },
    };
  }

  let session_token = {
    _id: crypto.randomUUID(),
    user: user._id,
    created: new Date(),
    token: crypto.randomBytes(32).toString("hex"),
  };
  await (await db.folder("Sessions")).insertOne(session_token);

  return {
    ok: true,
    message: "Login successful",
    session_token: session_token.token,
    data: user,
  };
};

const retrieve_api_key = async (req) => {
  let user = req.headers.profile;
  let db = req.db;

  let token = await (await db.folder("Tokens")).findOne({ user: user._id });

  if (!token) {
    token = {
      _id: crypto.randomUUID(),
      user: user._id,
      token: crypto.randomBytes(32).toString("hex"),
    };

    await (await db.folder("Tokens")).insertOne(token);
  }

  ({
    ok: true,
    message: "Key retrieved",
    data: { key: token.token },
  });
};

const two_factor_auth = async (req) => {
  let { email, code } = req.body;
  let db = req.db;

  let collection = await db.folder("OTPS:general");
  let otp = await collection.findOne({ id: email });

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

  if (new Date(otp.updatedAt).getTime() + OTP_expiry * 1000 * 60 < Date.now()) {
    return {
      ok: false,
      message: "OTP have expired",
    };
  }

  let user = await (await db.folder("Users")).findOne({ email });

  if (!user) {
    return {
      ok: false,
      message: "Platform not found",
    };
  }

  return {
    ok: true,
    message: "Login successful",
    data: user,
  };
};

const platform_by_uri = async (req) => {
  let { uri } = await req.body;
  let db = req.db;

  let plat = await (await db.folder("Users")).findOne({ uri });

  return {
    ok: true,
    message: "",
    data: plat,
  };
};

export {
  platform_by_uri,
  add_platform,
  verify_platform,
  resend_verification_otp,
  forgot_password,
  verify_forgot_password_otp,
  login_platform,
  send_mail,
  generate_otp,
  OTP_expiry,
  retrieve_api_key,
  two_factor_auth,
};
