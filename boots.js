import {
  PASSWORDS,
  PROFILE_TYPES,
  PROFILES,
  TOKENS,
  USERS,
} from "./ds/folders.js";
import { Platform_profile_type_id } from "./handlers/v2/platform.js";
import { hash } from "./utils/hash.js";

/**
 * =========================
 * HARD-CODED IDS
 * =========================
 */

// USERS
const ID_USER_EMAIL = "usr_email_001";
const ID_USER_PROFILE = "usr_profile_001";
const ID_USER_SETTINGS = "usr_settings_001";

// PROFILE TYPES
const ID_PROFILE_TYPE_PLATFORM = Platform_profile_type_id;
const ID_PROFILE_TYPE_SETTINGS = "ptype_settings_001";
const ID_PROFILE_TYPE_EMAIL = "ptype_email_001";

// PROFILES
const ID_PROFILE_EMAIL = "prof_email_001";
const ID_PROFILE_PROFILE = "prof_profile_001";
const ID_PROFILE_SETTINGS = "prof_settings_001";

const ID_PROFILE_SETTINGS_PROFILE = "prof_settings_profile_001";
const ID_PROFILE_EMAIL_PROFILE = "prof_email_profile_001";
const ID_PROFILE_EMAIL_SETTINGS = "prof_email_settings_001";

// TOKENS
const ID_TOKEN_PROFILE = "token_profile_001";
const ID_TOKEN_EMAIL = "token_email_001";
const ID_TOKEN_SETTINGS = "token_settings_001";

/**
 * =========================
 * USERS
 * =========================
 */

let email_user = {
  name: "Ai Mail",
  uri: "aimail.savvyaisolution.com",
  email: "aimail@savvyaisolution.com",
  created: new Date(),
  _id: ID_USER_EMAIL,
};

let profile_user = {
  name: "Profile",
  uri: "profile.savvyaisolution.com",
  email: "profile@savvyaisolution.com",
  created: new Date(),
  _id: ID_USER_PROFILE,
};

let settings_user = {
  name: "Settings",
  uri: "settings.savvyaisolution.com",
  email: "settings@savvyaisolution.com",
  created: new Date(),
  _id: ID_USER_SETTINGS,
};

/**
 * =========================
 * PROFILE TYPES
 * =========================
 */

const profile_type = {
  name: profile_user.name,
  created: new Date(),
  platform: profile_user._id,
  _id: ID_PROFILE_TYPE_PLATFORM,
};

let settings_profile_type = {
  name: settings_user.name,
  created: new Date(),
  platform: settings_user._id,
  _id: ID_PROFILE_TYPE_SETTINGS,
};

let email_profile_type = {
  name: email_user.name,
  created: new Date(),
  platform: email_user._id,
  _id: ID_PROFILE_TYPE_EMAIL,
};

/**
 * =========================
 * PROFILES
 * =========================
 */

let settings_profile = {
  name: settings_user.name,
  created: new Date(),
  email: settings_user.email,
  platform: profile_user._id,
  _id: ID_PROFILE_SETTINGS,
  profile: profile_type._id,
};

let email_profile = {
  name: email_user.name,
  email: email_user.email,
  created: new Date(),
  platform: profile_user._id,
  _id: ID_PROFILE_EMAIL,
  profile: profile_type._id,
};

let profile_profile = {
  name: profile_user.name,
  email: profile_user.email,
  created: new Date(),
  platform: profile_user._id,
  _id: ID_PROFILE_PROFILE,
  profile: profile_type._id,
};

// Cross-platform profiles

let profile_settings_profile = {
  name: profile_user.name,
  email: profile_user.email,
  created: new Date(),
  platform: settings_user._id,
  _id: ID_PROFILE_SETTINGS_PROFILE,
  profile: settings_profile_type._id,
};

let profile_email_profile = {
  name: profile_user.name,
  email: profile_user.email,
  created: new Date(),
  platform: email_user._id,
  _id: ID_PROFILE_EMAIL_PROFILE,
  profile: email_profile_type._id,
};

let email_settings_profile = {
  name: email_user.name,
  email: profile_user.email,
  created: new Date(),
  platform: settings_user._id,
  _id: ID_PROFILE_EMAIL_SETTINGS,
  profile: settings_profile_type._id,
};

/**
 * =========================
 * PASSWORDS
 * =========================
 */

let passwords = [
  {
    _id: ID_USER_PROFILE,
    key: hash(profile_user.name),
    created: new Date(),
  },
  {
    _id: ID_USER_EMAIL,
    key: hash(email_user.name),
    created: new Date(),
  },
  {
    _id: ID_USER_SETTINGS,
    key: hash(settings_user.name),
    created: new Date(),
  },
  {
    _id: ID_PROFILE_PROFILE,
    key: hash(profile_profile.name),
    created: new Date(),
  },
];

let profiles_passwords = [
  {
    _id: ID_PROFILE_SETTINGS_PROFILE,
    key: hash(profile_settings_profile.name),
    created: new Date(),
  },
  {
    _id: ID_PROFILE_EMAIL_PROFILE,
    key: hash(profile_email_profile.name),
    created: new Date(),
  },
  {
    _id: ID_PROFILE_EMAIL_SETTINGS,
    key: hash(email_settings_profile.name),
    created: new Date(),
  },
];

/**
 * =========================
 * TOKENS
 * =========================
 */

const tokens = [
  {
    _id: ID_TOKEN_PROFILE,
    token: "token_value_profile_001",
    user: ID_USER_PROFILE,
    created: new Date(),
  },
  {
    _id: ID_TOKEN_EMAIL,
    token: "token_value_email_001",
    user: ID_USER_EMAIL,
    created: new Date(),
  },
  {
    _id: ID_TOKEN_SETTINGS,
    token: "token_value_settings_001",
    user: ID_USER_SETTINGS,
    created: new Date(),
  },
];

/**
 * =========================
 * BOOTSTRAP
 * =========================
 */

const boots = async () => {
  let Profile_types = await PROFILE_TYPES();

  console.log("Checking if profile types exist...");
  if (await Profile_types.findOne({ _id: ID_PROFILE_TYPE_PLATFORM })) return;

  console.log("Profile types not found, creating...");

  let Users = await USERS();
  let Profiles = await PROFILES();
  let Passwords = await PASSWORDS();
  let Tokens = await TOKENS();

  await Users.insertMany([email_user, profile_user, settings_user]);

  await Profile_types.insertMany([
    profile_type,
    settings_profile_type,
    email_profile_type,
  ]);

  await Profiles.insertMany([email_profile, profile_profile, settings_profile]);

  await Passwords.insertMany(passwords);
  await Tokens.insertMany(tokens);
};

/**
 * =========================
 * EXTRA PROFILE CREATION
 * =========================
 */

const create_profiles = async () => {
  let Profiles = await PROFILES();
  let Passwords = await PASSWORDS();

  // Prevent duplicate insert
  console.log("Checking if cross-platform profiles exist...");
  if (await Profiles.findOne({ _id: ID_PROFILE_EMAIL_PROFILE })) return;
  console.log("Cross-platform profiles not found, creating...");

  await Profiles.insertMany([
    profile_settings_profile,
    profile_email_profile,
    email_settings_profile,
  ]);

  await Passwords.insertMany(profiles_passwords);
};

export { boots, create_profiles };
