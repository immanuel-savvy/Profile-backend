import { DB } from "./conn.js";

const USERS = async () => {
  let fold = await DB().collection("Users");

  return fold;
};

const PENDING_USERS = async () => {
  let fold = await DB().collection("Pending_users");

  return fold;
};

const STORE_OTP = async (profile) => {
  let fold = await DB().collection(profile ? "Profile_otp_store" : "Store_otp");

  return fold;
};

const PASSWORDS = async () => {
  let fold = await DB().collection("Passwords");

  return fold;
};

const PROFILE_PASSWORDS = async () => {
  let fold = await DB().collection("Profile_passwords");

  return fold;
};

const PROFILES = async () => {
  let fold = await DB().collection(`profiles`);

  return fold;
};

const PENDING_PROFILES = async () => {
  let fold = await DB().collection(`pending-profiles`);

  return fold;
};

const PROFILE_TYPES = async () => {
  let fold = await DB().collection(`profile_types`);

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
