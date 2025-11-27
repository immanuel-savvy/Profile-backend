import {
  PENDING_PROFILES,
  PROFILE_PASSWORDS,
  PROFILE_TYPES,
  PROFILES,
  STORE_OTP,
} from "../ds/folders.js";
import { send_profile_otp } from "../services/email.js";
import { hash } from "../utils/hash.js";

const signup = async (req, res) => {
  let { platform, profile_id, data, password } = req.body;

  // data-> email, firstname, lastname, bio,

  let Pending_profiles = await PENDING_PROFILES();

  let tried = await Pending_profiles.findOne({ profile_id, email: data.email });

  if (tried) {
    await Pending_profiles.updateOne({
      $set: { data },
    });

    return res.json({
      ok: true,
      message: "Profile pending verification",
    });
  }

  await Pending_profiles.insertOne({
    profile_id,
    password,
    email: data.email,
    data,
  });

  let response = await send_profile_otp(data.email, {
    platform,
    profile_type: type,
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
  profile = await Profile_types.findOne({ _id: profile });
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
    let Pending_profiles = await PENDING_PROFILES();
    let profile_usr = await Pending_profiles.findOneAndDelete({
      email,
      profile_id: profile,
    });

    profile_usr.data.verified = true;
    let password = profile_usr.password;

    let Profiles = await PROFILES();
    let result = await Profiles.insertOne({ ...profile_usr.data, profile });

    let Passwords = await PROFILE_PASSWORDS();
    await Passwords.insertOne({
      _id: result.insertedId,
      key: hash(password),
    });

    response.data = profile_usr;
  }

  res.json(response);
};

const update_profile_password = async (req, res) => {
  let { profile, password } = req.body;

  let Passwords = await PROFILE_PASSWORDS();

  let result = await Passwords.updateOne(
    { _id: profile },
    { $set: { key: hash(password) } }
  );

  res.json({
    ok: !!result.modifiedCount,
    message: result.modifiedCount
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
    ok: true,
    message: "Profile retrieved",
    data: profile,
  });
};

export { signin, signup, verify_profile, get_profile, update_profile_password };
