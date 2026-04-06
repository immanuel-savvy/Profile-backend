import {
  OTPS,
  PASSWORDS,
  PENDING_USERS,
  PROFILES,
  SESSIONS,
  TOKENS,
  USERS,
} from "../../ds/folders.js";
import crypto from "crypto";
import { hash } from "../../utils/hash.js";
import { retrieve_setting, service_auth } from "./profiles.js";
import { email_service } from "../../services/email.js";

let Platform_profile_type_id = "platform_profile_type_id"; // profile type id for platforms

export { Platform_profile_type_id };

const send_mail = async ({ from, to, content }, platform) => {
  let auth = await service_auth(platform, "aimail.savvyaisolution.com");

  console.log(auth, platform, "WHAT?");
  if (!auth) {
    return;
  }

  if (content?.variables?.profile) {
    let profile = content.variables.profile;
    content.variables.profile = {
      ...profile,
      name: `${profile.name || profile.fullname || `${profile.firstname} ${profile.lastname}`.trim()}`,
    };
  }

  let res = await fetch(`${email_service}/send_mail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-version": "v2",
      "x-platform": `profile.savvyaisolution.com`,
      Authorization: `Bearer ${auth}`,
    },
    body: JSON.stringify({
      from,
      to,
      content,
    }),
  });

  res = res.json();

  return res;
};

const generate_otp = async (id, sub, opts = {}) => {
  let { expiry = 5, length = 6 } = opts || {};

  const collection = await OTPS(sub);

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

const add_platform = async (req, res) => {
  try {
    let { email, name, password } = req.body;

    const Users = await USERS();
    const Pending = await PENDING_USERS();

    // Normalize inputs
    const cleanName = name.replace(/\s+/g, "").toLowerCase();
    const emailDomain = email.split("@")[1].toLowerCase();

    // Create URI
    const uri = `${cleanName}.${emailDomain}`;

    // Check existing
    let exist = await Users.findOne({
      $or: [{ email }, { name }],
    });

    if (exist) {
      let msg;

      if (email === exist.email && name === exist.name) {
        msg = "Email and Name have already been used";
      } else if (email === exist.email) {
        msg = "Email has already been used";
      } else if (name === exist.name) {
        msg = "Name has already been used";
      }

      return res.json({
        ok: false,
        message: msg,
      });
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

    const otp = await generate_otp(email);

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
        await PROFILES()
      ).findOne({
        _id: process.env.PROFILE_ID,
      }),
    );

    return res.json({
      ok: mail_res.ok || false,
      message: mail_res.ok
        ? "OTP sent to your email. Verify to continue."
        : mail_res.message || "Failed to send OTP email",
      data: { email, name, uri }, // ✅ return it too
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      ok: false,
      message: "Internal server error",
    });
  }
};

const verify_platform = async (req, res) => {
  let { email, code } = req.body;

  let collection = await OTPS();
  let otp = await collection.findOne({ id: email });

  if (!otp) {
    return res.json({
      ok: false,
      message: "OTP not found",
    });
  }

  if (otp.code !== code) {
    return res.json({
      ok: false,
      message: "OTP does not match",
    });
  }

  if (new Date(otp.updatedAt).getTime() + OTP_expiry * 1000 * 60 < Date.now()) {
    return res.json({
      ok: false,
      message: "OTP have expired",
    });
  }

  let Pending = await PENDING_USERS();
  let platform = await Pending.findOne({ email });

  let pass = platform.password;
  delete platform.password;

  await (await USERS()).insertOne(platform);
  let platform_profile = {
    ...platform,
    profile: Platform_profile_type_id,
    platform: platform?._id,
  };
  delete platform_profile.uri;
  await (await PROFILES()).insertOne(platform_profile);
  await (await PASSWORDS()).insertOne({ _id: platform._id, key: pass });

  await (
    await TOKENS()
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
    await (await PROFILES()).findOne({ _id: process.env.PROFILE_ID }),
  );

  res.json({
    ok: true,
    message: "Platform verified",
    data: platform,
  });
};

const resend_verification_otp = async (req, res) => {
  let { email } = req.body;

  let Pending = await PENDING_USERS();
  let platform = await Pending.findOne({ email });

  if (!platform) {
    return res.json({
      ok: false,
      message: "Platform not found",
    });
  }

  const otp = await generate_otp(email);

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
    await (await PROFILES()).findOne({ _id: process.env.PROFILE_ID }),
  );

  return res.json({
    ok: mail_res.ok || false,
    message: mail_res.ok
      ? "OTP resent to your email. Verify to continue."
      : mail_res.message || "Failed to resend OTP email",
  });
};

const forgot_password = async (req, res) => {
  let { email } = req.body;

  let user = await (await USERS()).findOne({ email });

  if (!user) {
    return res.json({
      ok: false,
      message: "Platform not found",
    });
  }

  const otp = await generate_otp(email);

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
    await (await PROFILES()).findOne({ _id: process.env.PROFILE_ID }),
  );

  return res.json({
    ok: mail_res.ok || false,
    message: mail_res.ok
      ? "OTP sent to your email. Verify to continue."
      : mail_res.message || "Failed to send OTP email",
  });
};

const verify_forgot_password_otp = async (req, res) => {
  let { email, code, new_password } = req.body;

  let collection = await OTPS();
  let otp = await collection.findOne({ id: email });

  if (!otp) {
    return res.json({
      ok: false,
      message: "OTP not found",
    });
  }

  if (otp.code !== code) {
    return res.json({
      ok: false,
      message: "OTP does not match",
    });
  }

  if (new Date(otp.updatedAt).getTime() + OTP_expiry * 1000 * 60 < Date.now()) {
    return res.json({
      ok: false,
      message: "OTP have expired",
    });
  }

  let user = await (await USERS()).findOne({ email });

  if (!user) {
    return res.json({
      ok: false,
      message: "Platform not found",
    });
  }

  const hashedPassword = hash(new_password);

  await (
    await PASSWORDS()
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
    await (await PROFILES()).findOne({ _id: process.env.PROFILE_ID }),
  );

  return res.json({
    ok: true,
    message: "Password updated successfully",
  });
};

const login_platform = async (req, res) => {
  let { email, password } = req.body;

  let user = await (await USERS()).findOne({ email });

  if (!user) {
    return res.json({
      ok: false,
      message: "Platform not found",
    });
  }

  let pass = await (await PASSWORDS()).findOne({ _id: user._id });

  if (pass.key !== hash(password)) {
    return res.json({
      ok: false,
      message: "Incorrect password",
    });
  }

  let setting = await retrieve_setting(user);
  if (setting?.two_factor_auth) {
    // Generate OTP
    const otp = await generate_otp(email, "two_factor_auth");

    // Send mail
    await send_mail(
      {
        from: { name: "Profile" },
        to: email,
        content: {
          template: "two_factor_auth_otp",
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
      await (await PROFILES()).findOne({ _id: process.env.PROFILE_ID }),
    );

    return res.json({
      ok: true,
      message: "OTP sent to your email. Verify to continue.",
      data: { two_factor_auth: true, email },
    });
  }

  let session_token = {
    _id: crypto.randomUUID(),
    user: user._id,
    created: new Date(),
    token: crypto.randomBytes(32).toString("hex"),
  };
  await (await SESSIONS()).insertOne(session_token);

  return res.json({
    ok: true,
    message: "Login successful",
    session_token: session_token.token,
    data: user,
  });
};

const retrieve_api_key = async (req, res) => {
  let user = req.headers.profile;

  let token = await (await TOKENS()).findOne({ user: user._id });

  if (!token) {
    token = {
      _id: crypto.randomUUID(),
      user: user._id,
      token: crypto.randomBytes(32).toString("hex"),
    };

    await (await TOKENS()).insertOne(token);
  }

  res.json({
    ok: true,
    message: "Key retrieved",
    data: { key: token.token },
  });
};

const two_factor_auth = async (req, res) => {
  let { email, code } = req.body;

  let collection = await OTPS();
  let otp = await collection.findOne({ id: email });

  if (!otp) {
    return res.json({
      ok: false,
      message: "OTP not found",
    });
  }

  if (otp.code !== code) {
    return res.json({
      ok: false,
      message: "OTP does not match",
    });
  }

  if (new Date(otp.updatedAt).getTime() + OTP_expiry * 1000 * 60 < Date.now()) {
    return res.json({
      ok: false,
      message: "OTP have expired",
    });
  }

  let user = await (await USERS()).findOne({ email });

  if (!user) {
    return res.json({
      ok: false,
      message: "Platform not found",
    });
  }

  return res.json({
    ok: true,
    message: "Login successful",
    data: user,
  });
};

const platform_by_uri = async (req, res) => {
  let { uri } = await req.body;

  let plat = await (await USERS()).findOne({ uri });

  res.json({
    ok: true,
    message: "",
    data: plat,
  });
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
