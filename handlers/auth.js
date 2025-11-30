import { PASSWORDS, PENDING_USERS, STORE_OTP, USERS } from "../ds/folders.js";
import { base_domain, FROM, send_mail, send_otp } from "../services/email.js";
import { hash } from "../utils/hash.js";
import crypto from "crypto";

const PROFILE_ID = "profile-savvyaisolution",
  PROFILE_EMAIL = "profile@savvyaisolution.com";

const register = async (req, res) => {
  let data = req.body;
  // email, fullname, about, password,
  data.password = hash(data.password);

  if (data.email) data.email = data.email.trim().toLowerCase();

  let Pending_users = await PENDING_USERS();
  let tried = await Pending_users.findOne({ email: data.email });

  if (tried) {
    await send_otp(data.email, data.fullname);
    await Pending_users.updateOne(
      { _id: tried._id },
      {
        $set: data,
      }
    );

    return res.json({
      ok: true,
      message: "User pending verification",
    });
  }

  let response;
  const pendingId = crypto.randomUUID();
  data._id = data.email === PROFILE_EMAIL ? PROFILE_ID : pendingId;

  if (data.email === PROFILE_EMAIL) {
    response = { sent: true };
  } else {
    response = await send_otp(data.email, data.fullname);
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
  if (email) email = email.trim().toLowerCase();

  let Stored_otp = await STORE_OTP();
  let store;

  if (email === PROFILE_EMAIL) {
    store = { otp: process.env.PROFILE_OTP };
  } else {
    store = await Stored_otp.findOne({ email });
  }

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
    // delete the OTP record after successful verification (for non-profile email)
    if (email !== PROFILE_EMAIL) {
      await Stored_otp.deleteOne({ email });
    }

    let Pending_users = await PENDING_USERS();
    let deleted = await Pending_users.findOneAndDelete({ email });

    let usr = deleted?.value ?? deleted;
    if (!usr) {
      return res.json({
        ok: false,
        message: "Pending user not found",
      });
    }

    usr.verified = true;
    let password = usr.password;
    const userId = usr._id;
    delete usr.password;
    usr.created = Date.now();

    let Users = await USERS();
    await Users.insertOne({
      _id: userId,
      ...usr,
    });

    await send_mail(
      usr.email,
      {
        brand_name: FROM,
        user_name: usr.fullname,
        support_email: `profile-support@savvyaisolution.com`,
        dashboard_link: `https://profile.${base_domain}/dashboard?platform_token=${userId}`,
      },
      "welcome:branded-support"
    );

    let Passwords = await PASSWORDS();
    await Passwords.insertOne({ _id: userId, key: password });

    response.data = { ...usr, _id: userId };
  }

  res.json(response);
};

const login = async (req, res) => {
  let { email, password } = req.body;

  if (email) email = email.trim().toLowerCase();

  let Users = await USERS();
  let usr = await Users.findOne({ email });

  if (!usr) {
    return res.json({
      ok: false,
      message: "User does not exist",
    });
  }

  if (!usr.verified) {
    return res.json({
      ok: false,
      message: "User not verified",
    });
  }

  let password_store = await (await PASSWORDS()).findOne({ _id: usr._id });

  if (!password_store) {
    return res.json({
      ok: false,
      message: "Password not set",
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
    data: usr,
  });
};

const get_user = async (req, res) => {
  let { email, token } = req.body;

  if (email) email = email.trim().toLowerCase();
  let user = await (await USERS()).findOne({ email });

  res.json({
    ok: !!user,
    message: user ? "User retrieved" : "User not found",
    data: user,
  });
};

export { register, verify, login, get_user, PROFILE_ID };
