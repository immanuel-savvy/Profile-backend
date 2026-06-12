import { create_session_object } from "./helpers/profiles.js";

const signup_with = async (req, opts = {}) => {
  let { is_signin } = opts || {};
  const { body, headers, db, services } = req;

  const { third_party_token, session_token, profile_type } = body;

  const { platform } = headers;

  let Third_parties = await db.folder("Third_party_platforms");
  let third_party = await Third_parties.findOne({
    api_key: third_party_token,
    target_platform: platform._id,
  });

  if (!third_party) {
    return {
      ok: false,
      message: "Invalid third party token",
    };
  }

  let Sessions = await db.folder("Sessions");
  let session = await Sessions.findOne({ token: session_token });
  if (!session) {
    return {
      ok: false,
      message: "Invalid session token",
    };
  }

  let Profile_types = await db.folder("Profile_types");
  let profiletype = await Profile_types.findOne({
    _id: profile_type,
    platform: platform._id,
  });

  if (!profiletype) {
    return {
      ok: false,
      message: "Profile type is not valid",
    };
  }

  let Profiles = await db.folder("Profiles");
  let session_profile = await Profiles.findOne({ _id: session.profile });

  let settings = await (
    await services("settings")
  ).call("get_settings", {
    category: [platform._id],
    key: ["identity"],
  });
  let identity_settings = settings?.identity;
  if (!identity_settings) {
    identity_settings = {
      uniques: ["email"],
    };
  }

  let query = {};
  for (const u of identity_settings.uniques) {
    if (session_profile[u]) {
      query[u] = session_profile[u];
    }
  }

  if (!Object.keys(query).length) {
    return {
      ok: false,
      message: "No valid identity fields found",
    };
  }

  let profile = await Profiles.findOne({
    ...query,
    platform: platform._id,
    profile: profile_type,
  });

  let is_new;
  if (!profile) {
    if (is_signin) {
      return {
        ok: false,
        message: "Profile not found. Sign-up",
      };
    } else {
      is_new = true;
      profile = {
        ...query,
        profile: profile_type,
        platform: platform._id,
        created: Date.now(),
        _id: crypto.randomUUID(),
      };

      await Profiles.insertOne(profile);
      let aimail = await services("aimail");

      await aimail.call(
        "send_mail",
        {
          from: platform.name,
          to: profile.email,
          content: {
            template: "signup-welcome",
            params: {
              profile,
              profile_type: profiletype,
              platform,
            },
          },
        },
        { profile: platform.profile },
      );

      await create_session_object(profile, platform, req, {
        from_signup_with: true,
        third_party: {
          _id: third_party.owner_platform,
          profile: session_profile._id,
        },
      });
    }
  }

  let sess = await create_session_object(profile, platform, req, {
    from_signup_with: !is_new,
    by: third_party.owner_platform,
  });

  // Now manage permission dependencies.
  let Platforms = await db.folder("Platforms");

  let permission_uris = Object.keys(third_party.permissions);
  let platforms = await Platforms.find({
    uri: { $in: permission_uris },
  }).toArray();

  let sessions = await Sessions.find({
    platform: { $in: platforms.map((p) => p._id) },
    third_party_profile: session_profile._id,
  }).toArray();

  let profiles = await Profiles.find({
    _id: { $in: sessions.map((s) => s.profile) },
  }).toArray();

  let permission_sessions = new Array();
  for (let s = 0; s < sessions.length; s++) {
    let session = sessions[s];

    let res = await create_session_object(
      profiles.find((p) => p._id === session.profile),
      platforms.find((p) => p._id === session.platform),
      req,
      {
        from_signup_with: true,
        third_party: {
          profile: profile._id,
          uri: platform.uri,
          _id: platform._id,
        },
      },
    );

    permission_sessions.push(res);
  }

  return {
    ok: true,
    message: `Signed-up with Successful`,
    token: sess.token,
    data: { permissions: permission_sessions, profile },
  };
};

export { signup_with };
