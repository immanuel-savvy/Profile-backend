import { PROFILE_TYPES, SETTINGS, STORE_OTP, USERS } from "../ds/folders.js";
import { PROFILE_ID } from "../handlers/auth.js";

let base_domain = `savvyaisolution.com`;
let email_service = `https://email-api.${base_domain}`;
let FROM = "Savvy Profile";

let gen_otp = (length = 6) => {
  let otp = Math.random()
    .toString()
    .slice(-1 * length);

  return otp;
};

const send_mail = async (email, args, template, from) => {
  let res = await fetch(`${email_service}/send`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: {
      email,
      user: PROFILE_ID,
      template,
      from: from || FROM,
      args,
    },
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
    await (await STORE_OTP()).insertOne({ otp, email });

    res = res.data;
  }

  return res;
};

const send_profile_otp = async (email, { platform, profile_type, profile }) => {
  let settings = await (await SETTINGS()).findOne({ _id: platform });

  let otp_expiry = settings?.otp_expiry?.toString() || "5";
  let otp = gen_otp(settings?.otp_length, otp_expiry);

  profile_type = await (await PROFILE_TYPES()).findOne({ _id: profile_type });

  let platfom = await (await USERS()).findOne({ _id: platform });

  let res = await fetch(`${email_service}/send`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user: PROFILE_ID,
      email,
      from: platfom.fullname,
      template: "otp:branded",
      args: {
        otp_code: otp,
        expiry_time: otp_expiry,
        brand_name: profile_type?.name,
        user_name: profile.firstname
          ? `${profile.firstname} $${profile.lastname}`
          : "There",
      },
    }),
  });
  res = await res.json();

  if (res?.data?.sent)
    await (
      await STORE_OTP(true)
    ).insertOne({ otp, email, otp_expiry, profile_id: profile_type._id });

  return res;
};

export { send_otp, send_profile_otp, send_mail, FROM, base_domain };
