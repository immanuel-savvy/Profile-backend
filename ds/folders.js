import { DB } from "./conn.js";

const USERS = async () => {
  let fold = await DB().collection("Users");

  return fold;
};

const PENDING_USERS = async () => {
  let fold = await DB().collection("Pending_users");

  return fold;
};

const STORE_OTP = async (profile_type_id) => {
  let fold = await DB().collection(
    "Store_otp".concat(profile_type_id ? `:${profile_type_id}` : "")
  );

  return fold;
};

const PASSWORDS = async () => {
  let fold = await DB().collection("Passwords");

  return fold;
};

const PROFILE_PASSWORDS = async (profile) => {
  let fold = await DB().collection("Profile_passwords".concat(`:${profile}`));

  return fold;
};

const PROFILES = async (platform, type = "default") => {
  let fold = await DB().collection(`profiles-${platform}-${type}`);

  return fold;
};

const PENDING_PROFILES = async (platform, type = "default") => {
  let fold = await DB().collection(`pending-profiles-${platform}-${type}`);

  return fold;
};

const PROFILE_TYPES = async (platform) => {
  let fold = await DB().collection(`profile_types-${platform}`);

  return fold;
};

export {
  USERS,
  PENDING_USERS,
  STORE_OTP,
  PASSWORDS,
  PROFILES,
  PROFILE_TYPES,
  PENDING_PROFILES,
  PROFILE_PASSWORDS,
};
