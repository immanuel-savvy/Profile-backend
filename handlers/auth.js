import { PASSWORDS, PENDING_USERS, STORE_OTP, USERS } from "../ds/folders";
import { send_otp } from "../services/email";
import { hash } from "../utils/hash";

const register = async (req, res) => {
  let data = req.body;
  // email, fullname, password

  let Pending_users = await PENDING_USERS();
  let tried = await Pending_users.findOne({ email: data.email });

  if (tried) {
    await Pending_users.updateOne({
      $set: { fullname: data.fullname, password: data.password },
    });

    return res.json({
      ok: true,
      message: "User pending verification",
    });
  }

  await Pending_users.insertOne(data);

  let response = await send_otp(data.email);

  res.json({
    ok: response.sent,
    message: response.sent
      ? `Verification code have been sent to email`
      : `Err, Something went wrong`,
  });
};

const verify = async (req, res) => {
  let { email, code } = req.body;

  let Stored_otp = await STORE_OTP();

  let store = await Stored_otp.findOne({ email });

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

    let Users = await USERS();
    let result = await Users.insertOne(usr);
    usr._id = result.insertedId;

    let Passwords = await PASSWORDS();
    await Passwords.insertOne({ _id: usr._id, password: hash(password) });

    response.data = usr;
  }

  res.json(response);
};

const login = async (req, res) => {
  let { email, password } = req.body;

  let Users = await USERS();
  let usr = await Users().findOne({ email });

  if (!usr) {
    return res.json({
      ok: false,
      message: "User does not exist",
    });
  }

  let password_store = await (await PASSWORDS()).findOne({ _id: usr._id });
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
    data: usr,
  });
};

export { register, verify, login };
