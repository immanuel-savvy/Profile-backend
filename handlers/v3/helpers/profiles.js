import { hash } from "../../../utils/hash.js";
import { get_settings } from "./settings.js";
import crypto from "crypto";

const get_platform_profile = async (req, platform) => {
  let { db } = req;
  platform = platform || req.headers.platform;

  let res = await (
    await db.folder("Profiles")
  ).findOne({ _id: platform?.profile });

  return res;
};

const generate_otp = async ({
  db,
  length = 6,
  expiry = 5,
  charset_type = "num",
  identity,
  sub = "general",
}) => {
  let otp = "";

  let folder = await db.folder(`Otps:${sub}`);

  if (!Array.isArray(identity)) {
    identity = [identity];
  }

  let charsets = {
    num: "0123456789",
    alpha: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    alnum: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    hex: "0123456789abcdef",
  };

  let chars = charsets[charset_type] || charsets.num;

  for (let i = 0; i < length; i++) {
    let bytes = new Uint8Array(1);

    crypto.getRandomValues(bytes);

    otp += chars[bytes[0] % chars.length];
  }

  let now = Date.now();

  let created = new Date(now);

  let expires_at = new Date(now + expiry * 60 * 1000);

  let existing = await folder.findOne({
    identity: { $all: identity },
  });

  let WINDOW_MS = 5 * 60 * 1000;
  let MAX_REQUESTS = 5;

  if (existing) {
    let lastreset = existing.lastreset || now;

    let withinWindow = now - lastreset < WINDOW_MS;

    if (withinWindow && existing.total_requests >= MAX_REQUESTS) {
      let remainingMs = WINDOW_MS - (now - lastreset);

      let minutes = Math.floor(remainingMs / 60000);
      let seconds = Math.ceil((remainingMs % 60000) / 1000);

      return {
        ok: false,
        status: 429,
        message: `Too many OTP requests. Try again in ${minutes}m ${seconds}s.`,
      };
    }
  }

  let doc = {
    _id: existing?._id || crypto.randomUUID(),
    identity,
    key: hash(otp),
    created,
    expires_at,
  };

  let update = {
    key: doc.key,
    expires_at: doc.expires_at,
  };

  let payload = {
    $set: update,

    $setOnInsert: {
      _id: doc._id,
      identity: doc.identity,
      created: doc.created,
      total_requests: 1,
      lastreset: now,
    },
  };

  if (!existing) {
    await folder.insertOne({
      _id: doc._id,
      identity,
      key: doc.key,
      created,
      expires_at,
      total_requests: 1,
      lastreset: now,
    });
  } else {
    const shouldResetWindow =
      !existing.lastreset || now - existing.lastreset >= WINDOW_MS;

    await folder.updateOne(
      { _id: existing._id },
      shouldResetWindow
        ? {
            $set: {
              key: doc.key,
              expires_at,
              total_requests: 1,
              lastreset: now,
            },
          }
        : {
            $set: {
              key: doc.key,
              expires_at,
            },
            $inc: {
              total_requests: 1,
            },
          },
    );
  }

  return {
    ok: true,
    _id: doc._id,
    identity,
    otp,
    expires_at,
  };
};

const create_session_object = async (profile, platform, req, options) => {
  let {
    meta_payload,
    session_settings,
    template,
    third_party,
    from_signup_with,
    no_notify,
    is_refresh,
    by,
  } = options || {};
  no_notify = no_notify || is_refresh || from_signup_with;

  let Sessions = await req.db.folder("Sessions");
  let obj = {
    _id: crypto.randomUUID(),
    profile: profile._id,
    profile_type: profile.profile,
    platform: platform._id,
    platform_uri: platform.uri,
    token: crypto.randomBytes(48).toString("hex"),
    created: Date.now(),
  };
  if (third_party) {
    obj.third_party_id = third_party._id;
    obj.third_party_uri = third_party.uri;
    obj.third_party_profile = third_party.profile;
  }
  if (by) {
    obj.by = by;
  }

  await Sessions.insertOne(obj);

  if (is_refresh) {
    await Sessions.deleteOne({ token: is_refresh });
  }

  // Send signin notification only if email is present.
  if (profile?.email && !no_notify) {
    if (!session_settings) {
      let settings = await get_settings({
        req,
        body: { category: [profile.profile], key: ["session"] },
      });

      session_settings = settings?.session;
    }

    if (session_settings?.notification?.enabled) {
      await (
        await req.services("aimail")
      ).call(
        "send_mail",
        {
          to: profile.email,
          from: platform.name,
          content: {
            template:
              session_settings.notification?.template ||
              template ||
              "signin-notification",
            params: {
              profile,
              device: meta_payload?.device || "-",
              platform,
              datetime: {
                date: new Date().toDateString(),
                time: new Date().toTimeString(),
              },
            },
          },
        },
        { profile: platform.profile },
      );
    }
  }

  return obj;
};

const validate_continuation = async (db, continuation_token, props) => {
  let { otp, token, sub = "general", validation_token } = props;

  if (validation_token) {
    let Validations = await db.folder("Validations");
    let validation = await Validations.findOne({ _id: validation_token, sub });
    if (!validation) {
      return {
        ok: false,
        message: "Invalid validation token",
      };
    }

    await Validations.deleteOne({ _id: validation_token });

    return { ok: true, continuation: validation.continuation };
  }

  let continuation_db = await db.folder("2fa_continuations");
  let continuation = await continuation_db.findOne({ _id: continuation_token });

  if (!continuation) {
    return { ok: false, status: 400, message: "Invalid continuation token" };
  }
  if (continuation.type === "otp") {
    let otp_folder = await db.folder(`Otps:${sub}`);
    let otp_entry = await otp_folder.findOne({ _id: continuation_token });

    if (!otp_entry) {
      await continuation_db.deleteOne({ _id: continuation._id });

      return { ok: false, message: "Invalid Token" };
    }

    if (otp_entry.expires_at < new Date()) {
      await continuation_db.deleteOne({ _id: continuation._id });

      return { ok: false, status: 400, message: "OTP expired" };
    }

    if (otp_entry.key !== hash(otp)) {
      const updated = await continuation_db.findOneAndUpdate(
        { _id: continuation._id },
        { $inc: { trial: 1 } },
        { returnDocument: "after" },
      );

      let deleted;
      if (updated?.trial >= 5) {
        deleted = true;
        await continuation_db.deleteOne({ _id: updated._id });
      }

      return {
        ok: false,
        status: 400,
        message: deleted ? "Incorrect OTP. Resend" : "Incorrect OTP",
      };
    }
    await otp_folder.deleteOne({ _id: otp_entry._id });
  } else if (continuation.type === "link") {
    let Reset_tokens = await db.folder("Reset_tokens");
    let token_entry = await Reset_tokens.findOne({
      key: hash(token),
      type: sub,
    });

    if (!token_entry) {
      return { ok: false, status: 400, message: "Token invalid" };
    }
    if (token_entry.expires_at < new Date()) {
      await Reset_tokens.deleteOne({ _id: token_entry._id });
      return { ok: false, status: 400, message: "Token expired" };
    }
    // if (token_entry.type !== "signin") {
    //   return { ok: false, status: 400, message: "Invalid token type" };
    // }

    await Reset_tokens.deleteOne({ _id: token_entry._id });
  } else {
    return { ok: false, status: 400, message: "Invalid continuation type" };
  }

  await continuation_db.deleteOne({ _id: continuation_token });

  return { ok: true, continuation };
};

const two_fa_challenge = async ({
  req,
  profile,
  two_fa_settings,
  identity_settings,
  platform,
  profile_type,
  meta_payload,
  channel,
  otp_sub,
  template = {},
}) => {
  let { db } = req,
    sent_to;

  if (two_fa_settings) {
    let signin_response, continuation;
    if (two_fa_settings?.enabled) {
      if (two_fa_settings.two_factor_auth?.type === "otp") {
        continuation = await generate_otp({
          db,
          identity: identity_settings.uniques
            .map((field) => profile[field])
            .filter((f) => !!f),
          sub: otp_sub,
          length: two_fa_settings.two_factor_auth.otp?.length || 6,
          expiry: two_fa_settings.two_factor_auth.otp?.expiry || 5,
          charset_type: two_fa_settings.two_factor_auth.otp?.charset || "alnum",
        });

        if (!continuation?.ok) {
          return continuation;
        }

        if (
          channel !== "phone" &&
          identity_settings.uniques.includes("email") &&
          profile.email
        ) {
          signin_response = await (
            await req.services("aimail")
          ).call(
            "send_mail",
            {
              to: profile.email,
              from: platform.name,
              content: {
                template:
                  two_fa_settings.two_factor_auth.otp?.template || template.otp,
                params: {
                  otp: continuation.otp,
                  expiry: Math.ceil(
                    (continuation.expires_at - new Date()) / 60000,
                  ),
                  profile,
                  platform,
                  profile_type,
                },
              },
            },
            { profile: platform.profile },
          );
        }
        if (!signin_response?.ok) {
          if (identity_settings.uniques.includes("phone") && profile.phone) {
            signin_response = await (
              await req.services("aimail")
            ).call(
              "send_message",
              {
                to: profile.phone,
                from: platform.name,
                content: {
                  template:
                    two_fa_settings.two_factor_auth.otp?.template ||
                    template.otp,
                  params: {
                    otp: continuation.otp,
                    expiry: Math.ceil(
                      (continuation.expires_at - new Date()) / 60000,
                    ),
                    profile,
                    platform,
                    profile_type,
                  },
                },
              },
              { profile: platform.profile },
            );

            if (!signin_response?.ok) {
              return signin_response;
            } else sent_to = profile.phone;
          } else return signin_response;
        } else sent_to = profile.email;
      } else if (two_fa_settings.two_factor_auth?.type === "link") {
        let Reset_tokens = await db.folder("Reset_tokens");
        let token = crypto.randomBytes(48).toString("hex");
        continuation = {
          _id: crypto.randomUUID(),
          profile: profile._id,
          key: hash(token),
          type: otp_sub || "signin",
          created: Date.now(),
          expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes expiry
        };
        await Reset_tokens.insertOne(continuation);

        if (identity_settings?.uniques?.includes("email") && profile.email) {
          signin_response = await (
            await req.services("aimail")
          ).call(
            "send_mail",
            {
              to: profile.email,
              from: platform.name,
              content: {
                template:
                  two_fa_settings.two_factor_auth.link?.template ||
                  template.link,
                params: {
                  link: `${two_fa_settings.two_factor_auth.link.url}?token=${token}`,
                  expiry: 5,
                  profile_type,
                  platform,
                  profile,
                },
              },
            },
            { profile: platform.profile },
          );
        }
        if (!signin_response?.ok) {
          if (identity_settings?.uniques?.includes("phone") && profile.phone) {
            signin_response = await (
              await req.services("aimail")
            ).call(
              "send_message",
              {
                to: profile.phone,
                from: platform.name,
                content: {
                  template:
                    two_fa_settings.two_factor_auth.link?.template ||
                    template.link,
                  params: {
                    link: `${two_fa_settings.two_factor_auth.link.url}?token=${token}`,
                    expiry: 5,
                    platform,
                    profile_type,
                    profile,
                  },
                },
              },
              { profile: platform.profile },
            );

            if (!signin_response?.ok) return signin_response;
            else sent_to = profile.phone;
          } else return signin_response;
        } else sent_to = profile.email;
      }

      let continuation_db = await db.folder("2fa_continuations");

      await continuation_db.updateOne(
        {
          _id: continuation._id,
        },
        {
          $set: {
            profile: profile._id,
            type: two_fa_settings.two_factor_auth?.type,
            data: signin_response,
            meta_payload,
          },

          $setOnInsert: {
            _id: continuation._id,
            created: Date.now(),
          },
        },
        {
          upsert: true,
        },
      );
      return {
        ok: true,
        continuation_id: continuation?._id,
        type: two_fa_settings.two_factor_auth?.type,
        sent_to,
        data: signin_response,
      };
    }
  }
};

export {
  validate_continuation,
  generate_otp,
  create_session_object,
  get_platform_profile,
  two_fa_challenge,
};
