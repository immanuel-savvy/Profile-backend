import { PROFILE_TYPES, SETTINGS, STORE_OTP, USERS } from "../ds/folders.js";
import { PROFILE_ID } from "../handlers/auth.js";
import crypto from "crypto";

let base_domain = `savvyaisolution.com`;
let email_service = `https://email-api.${base_domain}`;
let FROM = "Profile Graph";

let gen_otp = (length = 4) => {
  let otp = Math.random()
    .toString()
    .slice(-1 * (length || 4));

  return otp;
};

const send_message_otp = async (phone, { platform, profile_type }) => {
  if (phone?.startsWith("+")) {
    phone = phone.slice(1);
  }
  let settings = await (await SETTINGS()).findOne({ _id: platform });

  let otp_expiry = settings?.otp_expiry?.toString() || "5";
  let otp = gen_otp(settings?.otp_length);

  profile_type = await (await PROFILE_TYPES()).findOne({ _id: profile_type });

  let platfom = await (await USERS()).findOne({ _id: platform });

  let res = await fetch(`${email_service}/send_message`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone,
      user: PROFILE_ID,
      message: `[${platfom.fullname}] Your OTP is ${otp}. Expires in ${otp_expiry} minutes.`,
    }),
  });

  res = await res.json();

  if (res?.data?.sent) {
    const StoreOtp = await STORE_OTP(true);
    const otpId = crypto.randomUUID();
    await StoreOtp.updateOne(
      { phone, profile_id: profile_type._id },
      {
        $set: { otp, otp_expiry, updated: Date.now() },
        $setOnInsert: { _id: otpId },
      },
      { upsert: true }
    );

    res = res.data;
  }

  return res;
};

const send_mail = async (email, args, template, from) => {
  let res = await fetch(`${email_service}/send`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      user: PROFILE_ID,
      template,
      from: from || FROM,
      args,
    }),
  });
  res = await res.json();

  return res;
};

const send_otp = async (email, fullname) => {
  let otp = gen_otp();

  let res = await fetch(`${email_service}/send`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      user: PROFILE_ID,
      from: FROM,
      template: "otp:branded",
      args: {
        otp_code: otp,
        expiry_time: "5",
        brand_name: FROM,
        user_name: fullname,
      },
    }),
  });
  res = await res.json();

  if (res?.data?.sent) {
    const StoreOtp = await STORE_OTP();
    const otpId = crypto.randomUUID();
    await StoreOtp.updateOne(
      { email },
      {
        $set: { otp, updated: Date.now() },
        $setOnInsert: { _id: otpId },
      },
      { upsert: true }
    );

    res = res.data;
  }

  return res;
};

const send_profile_otp = async (
  email,
  { platform, profile_type, profile, template }
) => {
  let settings = await (await SETTINGS()).findOne({ _id: platform });

  let otp_expiry = settings?.otp_expiry?.toString() || "5";
  let otp = gen_otp(settings?.otp_length);

  profile_type = await (await PROFILE_TYPES()).findOne({ _id: profile_type });

  let platfom = await (await USERS()).findOne({ _id: platform });

  let body = {
    user: PROFILE_ID,
    from: platfom.fullname,
    email,
    template: template || "otp:branded",
    args: {
      otp_code: otp,
      expiry_time: otp_expiry,
      brand_name: platfom?.fullname,
      user_name: profile.firstname
        ? `${profile.firstname} ${profile.lastname}`
        : "There",
    },
  };

  let res = await fetch(`${email_service}/send`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  res = await res.json();

  if (res?.data?.sent) {
    const StoreOtp = await STORE_OTP(true);
    const otpId = crypto.randomUUID();
    await StoreOtp.updateOne(
      { email, profile_id: profile_type._id },
      {
        $set: { otp, otp_expiry, updated: Date.now() },
        $setOnInsert: { _id: otpId },
      },
      { upsert: true }
    );

    res = res.data;
  }

  return res;
};

export {
  send_otp,
  send_profile_otp,
  send_mail,
  FROM,
  base_domain,
  send_message_otp,
};
