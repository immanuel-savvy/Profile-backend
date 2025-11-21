import { PROFILE_TYPES, STORE_OTP } from "../ds/folders.js";

let base_domain = `savvyaisolution.com`;
let email_service = `https://email-api.${base_domain}`;
let token = `user-service-token`;

let gen_otp = () => {
  let otp = Math.random().toString().slice(-6);

  return otp;
};

const send_otp = async (email) => {
  let otp = gen_otp();

  let res = await fetch(`${email_service}/send_email`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `${token}`,
    },
    body: JSON.stringify({ email, template: "otp", args: { otp } }),
  });
  res = await res.json();

  if (res?.data?.sent) await (await STORE_OTP()).insertOne({ otp, email });

  return res;
};

const send_profile_otp = async (email, { platform, profile_type, profile }) => {
  let otp = gen_otp();

  profile_type = await (
    await PROFILE_TYPES()
  ).findOne({ type: profile_type, platform });

  let res = await fetch(`${email_service}/send`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `${token}`,
    },
    body: JSON.stringify({
      email,
      template: "otp:branded",
      args: {
        otp,
        brand_name: profile_type?.name,
        user_name: profile.fullname,
      },
    }),
  });
  res = await res.json();

  if (res?.data?.sent)
    await (
      await STORE_OTP(true)
    ).insertOne({ otp, email, profile_id: profile_type._id });

  return res;
};

export { send_otp, send_profile_otp };
