import { PROFILE_TYPES, SETTINGS, STORE_OTP, USERS } from "../ds/folders.js";
import { PROFILE_ID } from "../handlers/v1/auth.js";
import crypto from "crypto";
import { HG_profile_id } from "../handlers/v1/profile.js";
import twilio from "twilio";

let base_domain = `savvyaisolution.com`;
let PROD = process.env.PROD || true;
let email_service = PROD
  ? `https://email-api.${base_domain}`
  : `http://localhost:4003`;
let settings_service = PROD
  ? `https://settings-api.${base_domain}`
  : `http://localhost:4005`;
let FROM = "Profile Graph";

let gen_otp = (length = 4) => {
  let otp = Math.random()
    .toString()
    .slice(-1 * (length || 4));

  return otp;
};

async function createVerification(phone) {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );

    const verification = await client.verify.v2
      .services(process.env.TWILIO_SERVICE)
      .verifications.create({
        channel: "sms",
        to: phone,
      });

    console.log(verification);
    return verification;
  } catch (err) {
    return;
  }
}

export { createVerification };

const send_message_otp = async (phone, { platform, profile_type }) => {
  let settings = await (await SETTINGS()).findOne({ _id: platform });

  let otp_expiry = settings?.otp_expiry?.toString() || "5";
  let otp = gen_otp(settings?.otp_length);

  profile_type = await (await PROFILE_TYPES()).findOne({ _id: profile_type });

  let platfom = await (await USERS()).findOne({ _id: platform });

  if (profile_type === HG_profile_id) {
    const StoreOtp = await STORE_OTP(true);
    const otpId = crypto.randomUUID();
    await StoreOtp.updateOne(
      { phone, profile_id: profile_type._id },
      {
        $set: { otp, otp_expiry, updated: Date.now() },
        $setOnInsert: { _id: otpId },
      },
      { upsert: true },
    );

    await createVerification(phone);
    return { sent: true };
  }

  let res = await fetch(`${email_service}/send_message`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: phone?.startsWith("+") ? phone.slice(1) : phone,
      user: PROFILE_ID,
      channel: "sms",
      message: `[${platfom.fullname}] Your OTP is ${otp}. Expires in ${otp_expiry} minutes.`,
    }),
  });

  res = await res.json();

  res = res.data;
  if (res.sent) {
    const StoreOtp = await STORE_OTP(true);
    const otpId = crypto.randomUUID();
    await StoreOtp.updateOne(
      { phone, profile_id: profile_type._id },
      {
        $set: { otp, otp_expiry, updated: Date.now() },
        $setOnInsert: { _id: otpId },
      },
      { upsert: true },
    );
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
      { upsert: true },
    );

    res = res.data;
  }

  return res;
};

const send_profile_otp = async (
  email,
  { platform, profile_type, profile, template },
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

  const StoreOtp = await STORE_OTP(true);
  const otpId = crypto.randomUUID();
  await StoreOtp.updateOne(
    { email, profile_id: profile_type._id },
    {
      $set: { otp, otp_expiry, updated: Date.now() },
      $setOnInsert: { _id: otpId },
    },
    { upsert: true },
  );

  res = res.data;

  return res;
};

export {
  send_otp,
  send_profile_otp,
  send_mail,
  FROM,
  email_service,
  base_domain,
  send_message_otp,
  settings_service,
};
