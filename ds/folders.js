import { DB } from "./conn.js";

const USERS = async () => {
  let fold = await DB().collection("Users");

  return fold;
};

const PROFILES_MAP = async () => {
  let fold = await DB().collection("Profiles_map");

  return fold;
};

const SESSIONS = async () => {
  let fold = await DB().collection("Sessions");

  return fold;
};

const TOKENS = async () => {
  let fold = await DB().collection("Tokens");

  return fold;
};

const OTPS = async (sub) => {
  let fold = await DB().collection(`OTPS:${sub || "general"}`);

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

const SETTINGS = async () => {
  let fold = await DB().collection("settings");

  return fold;
};

const RESET_TOKENS = async () => {
  let fold = await DB().collection("reset_tokens");

  return fold;
};

export {
  USERS,
  PENDING_USERS,
  STORE_OTP,
  RESET_TOKENS,
  SETTINGS,
  PROFILES_MAP,
  PASSWORDS,
  PROFILES,
  OTPS,
  PROFILE_TYPES,
  TOKENS,
  PENDING_PROFILES,
  SESSIONS,
  PROFILE_PASSWORDS,
};
