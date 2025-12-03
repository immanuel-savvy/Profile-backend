import {
  PENDING_PROFILES,
  PROFILE_PASSWORDS,
  PROFILE_TYPES,
  PROFILES,
  SETTINGS,
  STORE_OTP,
  USERS,
} from "../ds/folders.js";
import {
  send_mail,
  send_message_otp,
  send_profile_otp,
} from "../services/email.js";
import { hash } from "../utils/hash.js";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";

const WEB_CLIENT_ID = process.env.WEB_CLIENT_ID;
const client = new OAuth2Client(WEB_CLIENT_ID);

const VERIFICATION_MEANS = ["email", "phone"];

const signup = async (req, res) => {
  let { platform, profile_id, data, password, verification_means, social } =
    req.body;
  verification_means = VERIFICATION_MEANS[verification_means || 0];

  console.log(platform, profile_id, data, password);
  // data-> email, firstname, lastname, bio, ... (phone)

  if (social) {
    return await social_auth(social, { profile_id, res });
  }

  let Profiles = await PROFILES();

  // Check if email/phone already belongs to a verified profile
  if (data.email) data.email = data.email.trim().toLowerCase();
  const existingProfile = await Profiles.findOne({
    [verification_means]:
      verification_means === "email" ? data.email : data.phone,
    profile: profile_id,
  });

  if (existingProfile) {
    return res.json({
      ok: false,
      message: `This ${verification_means} is already registered for this profile type`,
    });
  }

  let Pending_profiles = await PENDING_PROFILES();

  let tried = await Pending_profiles.findOne({
    profile_id,
    [verification_means]:
      verification_means === "email" ? data.email : data.phone,
  });

  if (tried) {
    if (verification_means === "phone") {
      await send_message_otp(data.phone, {
        platform,
        profile_type: profile_id,
      });
    } else
      await send_profile_otp(data.email, {
        platform,
        profile_type: profile_id,
        profile: data,
      });
    await Pending_profiles.updateOne(
      { _id: tried._id },
      {
        $set: { data },
      }
    );

    return res.json({
      ok: true,
      message: "Profile pending verification",
    });
  }

  const pendingId = crypto.randomUUID();
  let obj = {
    _id: pendingId,
    profile_id,
    password,
    data,
    verification_means,
  };
  if (verification_means === "email") {
    obj.email = data.email;
  } else if (verification_means === "phone") {
    obj.phone = data.phone;
  }
  await Pending_profiles.insertOne(obj);

  let response;

  if (verification_means === "phone") {
    response = await send_message_otp(data.phone, {
      platform,
      profile_type: profile_id,
    });
  } else
    response = await send_profile_otp(data.email, {
      platform,
      profile_type: profile_id,
      profile: data,
    });

  res.json({
    ok: response?.sent,
    message: response?.sent
      ? `Verification code have been sent to ${verification_means}`
      : `Err, Something went wrong`,
  });
};

const verify_forgot_password = async (req, res) => {
  let { email, code, phone, profile, verification_means, platform } = req.body;
  verification_means = VERIFICATION_MEANS[verification_means || 0];

  let profile_data = await (await PROFILES()).findOne({ email, profile });

  if (!profile_data) {
    return res.json({
      ok: false,
      message: `Profile is not registered`,
    });
  }

  let Stored_otp = await STORE_OTP(true);

  let store = await Stored_otp.findOne({
    [verification_means]: verification_means === "email" ? email : phone,
    profile_id: profile,
  });

  if (!store) {
    return res.json({
      ok: false,
      message: "OTP is not found",
    });
  }

  let valid = store.otp === code;
  let response = {
    ok: valid,
    message: valid ? "Profile verified successfully" : "Verification failed",
  };

  if (valid) {
    response.data = profile_data;

    let platform_data = await (await USERS()).findOne({ _id: platform });
    await send_mail(
      profile_data.email,
      {
        user_name:
          profile_data.firstname || profile_data.lastname
            ? `${profile_data.firstname} ${profile_data.lastname}`.trim()
            : "There",
        brand_name: platform_data.fullname,
      },
      "password_reset:branded_successful",
      platform_data.fullname
    );
  }

  res.json(response);
};

const verify_profile = async (req, res) => {
  let { email, code, phone, profile, verification_means } = req.body;
  verification_means = VERIFICATION_MEANS[verification_means || 0];

  if (email) email = email.trim().toLowerCase();
  code = code.trim();

  let Profile_types = await PROFILE_TYPES();
  let profile_type = await Profile_types.findOne({ _id: profile });
  let Stored_otp = await STORE_OTP(true);

  let store = await Stored_otp.findOne({
    [verification_means]: verification_means === "email" ? email : phone,
    profile_id: profile,
  });

  if (!store) {
    return res.json({
      ok: false,
      message: "Profile is not registered",
    });
  }

  let valid = store.otp === code;
  let response = {
    ok: valid,
    message: valid ? "Profile verified successfully" : "Verification failed",
  };

  if (valid) {
    await Stored_otp.deleteOne({
      [verification_means]: verification_means === "email" ? email : phone,
      profile_id: profile,
    });

    let Pending_profiles = await PENDING_PROFILES();
    let deleted = await Pending_profiles.findOneAndDelete({
      [verification_means]: verification_means === "email" ? email : phone,
      profile_id: profile,
    });

    let profile_usr = deleted?.value ?? deleted;
    if (!profile_usr) {
      return res.json({
        ok: false,
        message: "Pending profile not found",
      });
    }

    profile_usr.data.verified = [verification_means];
    let password = profile_usr.password;

    const profileId = crypto.randomUUID();
    let Profiles = await PROFILES();
    await Profiles.insertOne({
      _id: profileId,
      ...profile_usr.data,
      profile,
    });

    // Send welcome message to email.
    if (profile_usr.data.email) {
      await send_welcome_email({ profile_type, profile_usr: profile_usr.data });
    }

    let Passwords = await PROFILE_PASSWORDS();
    await Passwords.insertOne({
      _id: profileId,
      key: hash(password),
    });

    response.data = { ...profile_usr.data, _id: profileId };
  }

  res.json(response);
};

const send_welcome_email = async ({ profile_type, profile_usr }) => {
  let platform = await (await USERS()).findOne({ _id: profile_type.platform });

  let args = {
    brand_name: platform.fullname,
  };

  if (profile_usr.firstname) {
    args.user_name = `${profile_usr.firstname} ${profile_usr.lastname}`.trim();
  }
  let setting = await (await SETTINGS()).findOne({ _id: platform._id });
  args.support_email = setting?.support_email || platform.email;
  await send_mail(
    profile_usr.email,
    args,
    setting?.welcome_email ||
      (args.user_name
        ? "welcome:branded-support"
        : "welcome:branded-no-username"),
    platform.fullname
  );
};

const update_profile_password = async (req, res) => {
  let { profile, password } = req.body;

  let Passwords = await PROFILE_PASSWORDS();

  let result = await Passwords.updateOne(
    { _id: profile },
    { $set: { key: hash(password) } },
    { upsert: true }
  );

  res.json({
    ok: !!(result.modifiedCount || result.upsertedCount),
    message:
      result.modifiedCount || result.upsertedCount
        ? "Password Updated"
        : "Password update failed",
  });
};

const social_auth = async (social, { profile_id, res }) => {
  let Profiles = await PROFILES();

  try {
    // 1. Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken: social.idToken,
      audience: WEB_CLIENT_ID,
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
      return res.json({
        ok: false,
        message: "Google account does not contain a valid email",
      });
    }

    // Object for insert-on-new-profile
    const obj = {
      firstname,
      lastname,
      image: picture,
    };

    const existing = await Profiles.findOne({ email, profile: profile_id });

    let result;

    if (existing) {
      // Determine fields that are missing
      const updateObj = {};
      if (!existing.firstname && firstname) updateObj.firstname = firstname;
      if (!existing.lastname && lastname) updateObj.lastname = lastname;
      if (!existing.image && picture) updateObj.image = picture;

      if (Object.keys(updateObj).length > 0) {
        // Only update if there are missing fields
        result = await Profiles.findOneAndUpdate(
          { email, profile: profile_id },
          { $set: updateObj },
          { returnDocument: "after" }
        );
      } else {
        // Nothing to update, just return existing
        result = existing;
      }
    } else {
      // 3. If no match found → manually insert
      const profileId = crypto.randomUUID();
      const profile_obj = {
        _id: profileId,
        ...obj,
        email,
        verified: ["email"],
        social_signon: true,
        profile: profile_id,
      };

      await Profiles.insertOne(profile_obj);
      result = profile_obj;

      await send_welcome_email({
        profile_type: await (
          await PROFILE_TYPES()
        ).findOne({ _id: profile_id }),
        profile_usr: profile_obj,
      });

      let Passwords = await PROFILE_PASSWORDS();
      await Passwords.insertOne({
        _id: profileId,
        key: hash(""),
      });
    }

    // 4. Respond with profile (updated or newly inserted)
    return res.json({
      ok: true,
      message: "User login successful",
      data: result,
    });
  } catch (error) {
    console.error("Invalid Google ID Token:", error.message);

    return res.json({
      ok: false,
      message: "Invalid Google authentication token",
    });
  }
};

const signin = async (req, res) => {
  let { email, password, profile: profile_id, social } = req.body;

  let Profiles = await PROFILES();
  if (social) {
    return await social_auth(social, { res, profile_id });
  }

  if (email) email = email.trim().toLowerCase();

  let profile = await Profiles.findOne({ email, profile: profile_id });

  if (!profile) {
    return res.json({
      ok: false,
      message: "User does not exist",
    });
  }

  let password_store = await (
    await PROFILE_PASSWORDS()
  ).findOne({ _id: profile._id });

  if (!password_store || password_store?.key === hash("")) {
    return res.json({
      ok: false,
      message: "Password not set",
      data: { _id: profile._id },
    });
  }

  let pass_pass = hash(password) === password_store.key;

  if (!pass_pass) {
    return res.json({
      ok: false,
      message: "Password invalid",
    });
  }

  res.json({
    ok: true,
    message: "User login successful",
    data: profile,
  });
};

const get_profile = async (req, res) => {
  let { email, profile_type, _id, token } = req.body;

  if (email) email = email.trim().toLowerCase();

  let Profiles = await PROFILES();
  let profile = await Profiles.findOne(
    _id ? { _id } : { email, profile: profile_type }
  );

  res.json({
    ok: !!profile,
    message: profile ? "Profile retrieved" : "Profile not found",
    data: profile,
  });
};

const resend_profile_otp = async (req, res) => {
  let { email, phone, platform, profile, verification_means, reason } =
    req.body;

  verification_means = VERIFICATION_MEANS[verification_means || 0];

  if (email) email = email.trim().toLowerCase();

  let data, false_message;
  if (reason && reason !== "profile_verification") {
    let profile_data = await (await PROFILES()).findOne({ email, profile });

    if (!profile_data) false_message = "Profile is not registered.";

    data = profile_data;
  } else {
    let Pending_profiles = await PENDING_PROFILES();

    let tried = await Pending_profiles.findOne({
      profile_id: profile,
      [verification_means]: verification_means === "email" ? email : phone,
    });

    if (!tried) false_message = "Registration does not exist.";
    else data = tried?.data;
  }

  if (!data) {
    return res.json({
      ok: false,
      message: false_message,
    });
  }

  let response;

  if (verification_means === "phone") {
    response = await send_message_otp(phone, {
      platform,
      profile_type: profile,
    });
  } else
    response = await send_profile_otp(email, {
      platform,
      profile_type: profile,
      profile: data,
      template: reason === "forgot_password" ? "forgot_password:branded" : "",
    });

  res.json({
    ok: response?.sent,
    message: response?.sent
      ? `Verification code have been sent to ${verification_means}`
      : `Err, Something went wrong`,
  });
};

export {
  signin,
  signup,
  verify_profile,
  get_profile,
  update_profile_password,
  resend_profile_otp,
  verify_forgot_password,
};
