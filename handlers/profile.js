import {
  PENDING_PROFILES,
  PROFILE_PASSWORDS,
  PROFILE_TYPES,
  PROFILES,
  SETTINGS,
  STORE_OTP,
  USERS,
} from "../ds/folders.js";
import { send_mail, send_profile_otp } from "../services/email.js";
import { hash } from "../utils/hash.js";
import crypto from "crypto";

const signup = async (req, res) => {
  let { platform, profile_id, data, password } = req.body;

  console.log(platform, profile_id, data, password);
  // data-> email, firstname, lastname, bio,

  let Pending_profiles = await PENDING_PROFILES();

  let tried = await Pending_profiles.findOne({ profile_id, email: data.email });

  if (tried) {
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
  await Pending_profiles.insertOne({
    _id: pendingId,
    profile_id,
    password,
    email: data.email,
    data,
  });

  let response = await send_profile_otp(data.email, {
    platform,
    profile_type: profile_id,
    profile: data,
  });

  res.json({
    ok: response.sent,
    message: response.sent
      ? `Verification code have been sent to email`
      : `Err, Something went wrong`,
  });
};

const verify_profile = async (req, res) => {
  let { email, code, profile } = req.body;

  let Profile_types = await PROFILE_TYPES();
  let profile_type = await Profile_types.findOne({ _id: profile });
  let Stored_otp = await STORE_OTP(true);

  let store = await Stored_otp.findOne({ email, profile_id: profile });

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
    await Stored_otp.deleteOne({ email, profile_id: profile });

    let Pending_profiles = await PENDING_PROFILES();
    let deleted = await Pending_profiles.findOneAndDelete({
      email,
      profile_id: profile,
    });

    let profile_usr = deleted?.value ?? deleted;
    if (!profile_usr) {
      return res.json({
        ok: false,
        message: "Pending profile not found",
      });
    }

    profile_usr.data.verified = true;
    let password = profile_usr.password;

    const profileId = crypto.randomUUID();
    let Profiles = await PROFILES();
    await Profiles.insertOne({
      _id: profileId,
      ...profile_usr.data,
      profile,
    });

    let platform = await (
      await USERS()
    ).findOne({ _id: profile_type.platform });

    let args = {
      brand_name: platform.fullname,
    };

    if (profile_usr.data.firstname) {
      args.user_name =
        `${profile_usr.data.firstname} ${profile_usr.data.lastname}`.trim();
    }
    let setting = await (await SETTINGS()).findOne({ _id: platform._id });
    args.support_email = setting?.support_email || platform.email;
    await send_mail(
      profile_usr.data.email,
      args,
      setting?.welcome_email ||
        (args.user_name
          ? "welcome:branded-support"
          : "welcome:branded-no-username"),
      platform.fullname
    );

    let Passwords = await PROFILE_PASSWORDS();
    await Passwords.insertOne({
      _id: profileId,
      key: hash(password),
    });

    response.data = { ...profile_usr.data, _id: profileId };
  }

  res.json(response);
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

const signin = async (req, res) => {
  let { email, password, profile: profile_id } = req.body;

  let Profiles = await PROFILES();
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

  if (!password_store) {
    return res.json({ ok: false, message: "Password not set" });
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
  let { email, profile_type, token } = req.body;

  let Profiles = await PROFILES();
  let profile = await Profiles.findOne({ email, profile: profile_type });

  res.json({
    ok: !!profile,
    message: profile ? "Profile retrieved" : "Profile not found",
    data: profile,
  });
};

export { signin, signup, verify_profile, get_profile, update_profile_password };
