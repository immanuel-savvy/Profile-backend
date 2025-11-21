import {
  PASSWORDS,
  PENDING_USERS,
  PROFILE_TYPES,
  PROFILES,
  STORE_OTP,
  USERS,
} from "../ds/folders.js";
import { send_otp } from "../services/email.js";
import { hash } from "../utils/hash.js";

const PROFILE_ID = "profile-savvyaisolution",
  PROFILE_EMAIL = "profile@savvyaisolution.com";

const register = async (req, res) => {
  let data = req.body;
  // email, fullname, about, password

  let Pending_users = await PENDING_USERS();
  let tried = await Pending_users.findOne({ email: data.email });

  if (tried) {
    await Pending_users.updateOne({
      $set: data,
    });

    return res.json({
      ok: true,
      message: "User pending verification",
    });
  }

  let response;
  if (data.email === PROFILE_EMAIL) {
    data._id = PROFILE_ID;

    response = { sent: true };
  } else {
    response = await send_otp(data.email);
  }

  await Pending_users.insertOne(data);

  res.json({
    ok: response.sent,
    message: response.sent
      ? `Verification code have been sent to email`
      : `Err, Something went wrong`,
  });
};

const verify = async (req, res) => {
  let { email, code } = req.body;

  let Stored_otp = await STORE_OTP(),
    store;

  if (email === PROFILE_EMAIL) {
    store = { otp: process.env.PROFILE_OTP };
  } else store = await Stored_otp.findOne({ email });

  if (!store) {
    return res.json({
      ok: false,
      message: "User is not registered",
    });
  }

  let valid = store.otp === code;
  let response = {
    ok: valid,
    message: valid ? "User verified successfully" : "Verification failed",
  };

  if (valid) {
    let Pending_users = await PENDING_USERS();
    let usr = await Pending_users.findOneAndDelete({ email });

    usr.verified = true;
    let password = usr.password;
    delete usr.password;
    usr.created = Date.now();

    let Users = await USERS();
    let result = await Users.insertOne(usr);
    usr._id = result.insertedId;

    let Passwords = await PASSWORDS();
    await Passwords.insertOne({ _id: usr._id, key: hash(password) });

    response.data = usr;
  }

  res.json(response);
};

const login = async (req, res) => {
  let { email, password } = req.body;

  let Users = await USERS();
  let usr = await Users.findOne({ email });

  if (!usr) {
    return res.json({
      ok: false,
      message: "User does not exist",
    });
  }

  let password_store = await (await PASSWORDS()).findOne({ _id: usr._id });
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
    data: usr,
  });
};

const get_user = async (req, res) => {
  let { email } = req.body;

  let user = await (await USERS()).findOne({ email });

  res.json({
    ok: !!user,
    message: "User retrieved",
    data: user,
  });
};

export { register, verify, login, get_user, PROFILE_ID };
