import { SETTINGS } from "../ds/folders.js";

const profile_signup_webhook = async (profile_type, user_profile) => {
  let settings = await (
    await SETTINGS()
  ).findOne({ _id: profile_type.platform });

  if (settings?.signup_webhook) {
    let ftch = await fetch(settings.signup_webhook, {
      method: "post",
      headers: {
        Accept: "application/json",
        "Content-type": "application/json",
      },
      body: JSON.stringify({
        profile: user_profile,
      }),
    });

    let response = await ftch.json();

    return { success: response?.ok, called: true };
  }

  return { success: null, called: false };
};

export { profile_signup_webhook };
