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
  let { platform, profile_id, data, password, type } = req.body;
  type = type || "default";

  let Pending_profiles = await PENDING_PROFILES(platform, type);

  let tried = await Pending_profiles.findOne({ profile_id });

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
  let { email, code, profile, platform } = req.body;

  let Profile_types = await PROFILE_TYPES(platform);
  profile = await Profile_types.findOne({ _id: profile });
  let Stored_otp = await STORE_OTP(profile._id);

  let store = await Stored_otp.findOne({ email });

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
    let Pending_profiles = await PENDING_PROFILES(platform, type);
    let profile_usr = await Pending_profiles.findOneAndDelete({ email });

    profile_usr.data.verified = true;
    let password = profile_usr.password;
    delete profile_usr.password;

    let Profiles = await PROFILES(platform, type);
    let result = await Profiles.insertOne(profile_usr.data);

    let Passwords = await PROFILE_PASSWORDS(profile._id);
    await Passwords.insertOne({
      _id: result.insertedId,
      password: hash(password),
    });

    response.data = profile_usr;
  }

  res.json(response);
};

const signin = async (req, res) => {
  let { email, password, platform, type } = req.body;

  let Profile_types = await PROFILE_TYPES(platform);
  let profile_type = await Profile_types.findOne({ type });

  let Profiles = await PROFILES(platform, type);
  let profile = await Profiles().findOne({ email });

  if (!profile) {
    return res.json({
      ok: false,
      message: "User does not exist",
    });
  }

  let password_store = await (
    await PROFILE_PASSWORDS(profile_type._id)
  ).findOne({ _id: profile._id });
  let pass_pass = hash(password) === password_store.password;

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
  let { email, platform, type } = req.body;

  let Profiles = await PROFILES(platform, type);
  let profile = await Profiles().findOne({ email });

  res.json({
    ok: true,
    message: "Profile retrieved",
    data: profile,
  });
};

export { signin, signup, verify_profile, get_profile };
