import crypto from "crypto";
import {
  create_session_object,
  get_platform_profile,
} from "./helpers/profiles.js";
import { get_settings } from "./helpers/settings.js";

/**
 * =========================================================
 * REGISTER THIRD PARTY
 * =========================================================
 *
 * Registers another platform as trusted to
 * generate sessions from this platform's auth.
 *
 * Example:
 *
 * Platform A allows Platform B to create
 * sessions using Platform A auth tokens.
 *
 * =========================================================
 */

const register_third_party = async (req) => {
  let { db, headers, body } = req;

  let { platform } = headers;

  let { uri, permissions = {}, profile_types } = body;

  let Third_party = await db.folder("Third_party_platforms");

  /**
   * =========================================================
   * DUPLICATE CHECK
   * =========================================================
   */

  let existing = await Third_party.findOne({
    owner_platform: platform._id,
    uri,
  });

  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Third party already registered",
    };
  }

  let Platforms = await db.folder("Platforms");

  let target_platform = await Platforms.findOne({ uri });

  if (!target_platform) {
    return {
      ok: false,
      status: 404,
      message: "Target platform not found",
    };
  }

  let api_key = crypto.randomBytes(24).toString("hex");

  let third_party = {
    _id: crypto.randomUUID(),

    owner_platform: platform._id,

    profile_types,

    uri: uri || null,

    permissions,

    api_key,

    enabled: true,

    created: Date.now(),
  };

  await Third_party.insertOne(third_party);

  return {
    ok: true,
    status: 201,
    message: "Third party registered",
    data: {
      _id: third_party._id,

      api_key,
      profile_types,

      permissions,
    },
  };
};

const get_third_party_registration = async (req) => {
  let { headers, body, db } = req;

  let { platform } = headers;
  let { uri } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let data = await Third_party_platforms.findOne({
    owner_platform: platform._id,
    uri,
  });

  return {
    message: data ? "Retrieved" : "Not found",
    response_code: data ? "retrieved" : "not_found",
    ok: !!data,
    data,
  };
};

const get_third_party_registrations_by_uri = async (req) => {
  let { headers, body, db } = req;

  let { platform } = headers;
  let { uris } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let query = { uri: { $in: uris }, owner_platform: platform._id };
  let data = await Third_party_platforms.find(query);

  return {
    ok: true,
    data,
    message: "Retrieved",
    response_code: "retrieved",
  };
};

const get_third_party_registrations = async (req) => {
  let { headers, body, db } = req;

  let { platform } = headers;
  let { limit, page } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let query = {
    owner_platform: platform._id,
  };
  let parties = await Third_party_platforms.find(query)
    .limit(limit)
    .skip(page * limit)
    .toArray();

  return {
    ok: true,
    data: parties,
    pagination: { folder: Third_party_platforms, limit, page, query },
    message: "Retrieved",
    response_code: "retrieved",
  };
};

const get_third_party = async (req) => {
  let { headers, body, db } = req;
  let { platform } = headers;
  let { token, owner_uri } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let query = { uri: platform.uri };
  if (token) query.token = token;

  let data = await Third_party_platforms.findOne(query);

  return {
    ok: !!data,
    data,
    message: data ? "Retrieved" : "Not found",
    response_code: data ? "retrieved" : "not_found",
  };
};

const get_third_parties = async (req) => {
  let { headers, body, db } = req;

  // Accept either a platform object or just a uri string in headers.platform
  let { platform } = headers;
  let { limit, page } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let items = await Third_party_platforms.find({ uri: platform.uri })
    .limit(limit)
    .skip(limit * page)
    .toArray();

  return {
    ok: true,
    message: "Retrieved",
    response_code: "retrieved",
    pagination: {
      folder: Third_party_platforms,
      query: { uri: platform.uri },
      page,
      limit,
    },
    data: items,
  };
};

const get_third_parties_by_uri = async (req) => {
  let { headers, body, db } = req;
  let { platform } = headers;
  let { platforms } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  platforms = await (
    await db.folder("Platforms")
  ).find({ uri: { $in: platforms } });

  let data = await Third_party_platforms.find({
    uri: platform.uri,
    owner_platform: { $in: platforms.map((p) => p._id) },
  });

  return {
    ok: true,
    data,
    message: "Retrieved",
    response_code: "retrieved",
  };
};

/**
 * =========================================================
 * AUTHORISE THIRD PARTY
 * =========================================================
 *
 * Flow:
 *
 * Platform B sends:
 * - api_key
 * - auth_token from Platform A
 *
 * We validate:
 * - Platform B is trusted
 * - auth_token valid on Platform A
 *
 * Then create a new session for
 * the same profile on Platform B.
 *
 * =========================================================
 */

const authorise_third_party = async (req) => {
  let { db, headers, body } = req;

  let { platform, profile } = headers;
  console.log(platform, profile, "HEADERS OF AUTHORISE THIRD PARTY");

  let { third_party_token, session_token } = body;

  let Third_party = await db.folder("Third_party_platforms");

  let integration = await Third_party.findOne({
    api_key: third_party_token,

    enabled: true,
  });

  if (!integration) {
    return {
      ok: false,
      status: 401,
      message: "Invalid third party token",
    };
  }

  let integration_platform = await (
    await db.folder("Platforms")
  ).findOne({ _id: integration.owner_platform });

  if (integration.uri !== platform.uri) {
    return {
      ok: false,
      status: 401,
      message: "Third party token does not belong to this platform",
    };
  }

  let Sessions = await db.folder("Sessions");

  console.log(
    session_token,
    integration_platform,
    "SESSION TOKEN AND INTEGRATION PLATFORM",
  );
  let session = await Sessions.findOne({
    token: session_token,
    platform_uri: integration_platform.uri,
  });

  if (!session) {
    return {
      ok: false,
      status: 401,
      message: "Invalid session token",
    };
  }

  let Profiles = await db.folder("Profiles");

  let session_profile = await Profiles.findOne({
    _id: session.profile,
  });

  if (!session_profile) {
    return {
      ok: false,
      status: 404,
      message: "Profile not found",
    };
  }

  let response_session = await create_session_object(
    session_profile,
    integration_platform,
    req,
    {
      third_party: {
        uri: platform.uri,
        profile: profile._id,
      },
    },
  );

  return {
    ok: true,
    message: "Authorised",
    token: response_session.token,
    data: response_session,
  };
};

const get_token = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;

  let { profile, platform_uri } = body;

  let Sessions = await db.folder("Sessions");

  let session = await Sessions.findOne({
    third_party_profile: profile,
    third_party_uri: platform.uri,
    platform_uri,
  });

  if (!session) {
    return {
      ok: false,
      message: "Session not found",
      status: 400,
    };
  }

  return {
    ok: true,
    message: "Session valid",
    token: session.token,
    data: session,
  };
};

/**
 * =========================================================
 * REFRESH THIRD PARTY TOKEN
 * =========================================================
 */

const refresh_third_party_token = async (req) => {
  let { db, headers, body } = req;

  let { platform } = headers;
};

const handle_permissions_session = async ({
  req,
  third_party,
  profile,
  session_platform,
  session_profile,
  platform,
}) => {
  let { db } = req;
  let Platforms = await db.folder("Platforms");
  let Sessions = await db.folder("Sessions");
  let Profiles = await db.folder("Profiles");

  let tokens = {};
  for (let uri in third_party.permissions) {
    let profile_types = third_party.permissions[uri];

    let sess = await Sessions.findOne({
      third_party_profile: profile._id,
      third_party_uri: platform.uri,
      platform_uri: uri,
      profile_type: { $in: profile_types },
    });

    if (!sess) {
      let uri_platform = await Platforms.findOne({ uri });

      let sesss = await Sessions.find({
        third_party_profile: session_profile._id,
        third_party_uri: session_platform.uri,
        platform_uri: uri,
        profile_type: { $in: profile_types },
      });

      for (let s = 0; s < sesss.length; s++) {
        let ses = sesss[s];

        sesss[s] = await create_session_object(
          await Profiles.fineOne({ _id: ses.profile }),
          uri_platform,
          req,
          {
            third_party: {
              uri: platform.uri,
              profile: profile._id,
            },
          },
        );
      }
      tokens[uri] = sesss;
    }
  }

  return tokens;
};

const third_party_signin = async (req, opt) => {
  let { from_signup } = opt || {};
  let { headers, db, body } = req;

  let { platform } = headers;
  let {
    third_party_token,
    session_token,
    profile_type,
    allow_signup,
    allow_signin,
  } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");
  let third_party = await Third_party_platforms.findOne({
    api_key: third_party_token,
  });

  if (!third_party) {
    return {
      ok: false,
      response_code: "invalid_third_party_token",
      message: "Invalid third party token",
      status: 400,
    };
  }

  // console.log(third_party.profile_types, profile_type, "PROFILE TYPE CHECK");

  if (!third_party.profile_types.includes(profile_type)) {
    return {
      ok: false,
      response_code: "type_out_of_scope",
      message: "Third party profile type out of scope",
      status: 400,
    };
  }

  let Platforms = await db.folder("Platforms");
  let session_platform = await Platforms.findOne({
    _id: third_party.owner_platform,
  });

  let Sessions = await db.folder("Sessions");
  let session_profile = await Sessions.findOne({
    token: session_token,
    platform: session_platform._id,
  });
  if (!session_profile) {
    return {
      ok: false,
      status: 400,
      response_code: "invalid_session_token",
      message: "Invalid session token",
    };
  }

  let Profiles = await db.folder("Profiles");
  session_profile = await Profiles.findOne({ _id: session_profile.profile });

  // Retrieve settings
  let setting_keys = ["identity", from_signup ? "signup" : "signin", "session"];

  let settings = await get_settings({
    req,
    body: {
      category: profile_type,
      key: setting_keys,
    },
  });

  let identity_settings = settings?.[profile_type]?.identity;
  if (!identity_settings) {
    identity_settings = {
      uniques: ["email"],
    };
  }

  const or = identity_settings.uniques.map((field) => ({
    [field]: session_profile[field],
  }));

  const profile = await Profiles.findOne({ profile: profile_type, $or: or });

  if (profile && from_signup && !allow_signin) {
    return {
      ok: false,
      message: "Profile already exist",
      response_code: "profile_already_exist",
      status: 400,
    };
  }

  if (!profile) {
    if (allow_signup && !from_signup) return await third_party_signup(req);

    return {
      ok: false,
      message: "Profile not found",
      response_code: "profile_not_found",
      status: 400,
      response: {
        settings,
        third_party,
        session_platform,
        session_profile,
      },
    };
  }

  let response = await create_session_object(profile, platform, req, {
    session_settings: settings?.[profile_type]?.session,
    by: session_platform.uri,
  });

  let tokens = await handle_permissions_session({
    req,
    third_party,
    platform,
    profile,
  });

  return {
    ok: true,
    response_code: "success",
    token: response.token,
    message: "Third party signin successful",
    data: { tokens, profile },
  };
};

const third_party_signup = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;
  let res = await third_party_signin(req, { from_signup: true });

  let { profile_type } = body;

  if (res.response_code === "profile_not_found") {
    let Profiles = await db.folder("Profiles");

    let { payload } = req;
    let { settings, session_platform, session_profile } = payload;

    let identity_settings = settings?.[profile_type]?.identity;
    if (!identity_settings) {
      identity_settings = {
        uniques: ["email"],
      };
    }

    let new_profile = {
      profile: profile_type,
      platform: platform._id,
      created: Date.now(),
      _id: crypto.randomUUID(),
    };

    let confirm_not_present = {};
    identity_settings.uniques.map((u) => {
      let v = session_profile[u];
      if (v != null) {
        confirm_not_present[u] = v;
        new_profile[u] = v;
      }
    });

    let existing = await Profiles.findOne({
      profile: profile_type,
      ...confirm_not_present,
    });
    if (existing) {
      return {
        ok: false,
        message: "Profile already exist",
        response_code: "profile_already_exist",
        status: 400,
      };
    }

    if (session_profile.fullname)
      if (session_profile.fullname) {
        new_profile.fullname = session_profile.fullname;
      } else {
        new_profile.fullname = `Profile ${crypto.randomBytes(3).toString("hex")}`;
      }
    if (session_profile.firstname)
      new_profile.firstname = session_profile.firstname;
    if (session_profile.lastname)
      new_profile.lastname = session_profile.lastname;

    await Profiles.insertOne(new_profile);

    let response = await create_session_object(new_profile, platform, req, {
      session_settings: settings.session,
      by: session_platform.uri,
    });

    let tokens = await handle_permissions_session({
      req,
      third_party,
      session_platform,
      session_profile,
      platform,
    });

    let welcome_notification = settings?.signup?.notification;
    if (new_profile.email) {
      await req.services("aimail").call("send_mail", {
        to: new_profile.email,
        content: {
          template: welcome_notification?.template || "welcome",
          params: { profile: new_profile },
        },
      });
    }

    res = {
      ok: true,
      token: response.token,
      message: "Third party Signup successful",
      response_code: "third_party_signup_successful",
      data: {
        profile: new_profile,
        tokens,
      },
    };
  }

  return res;
};

const grant_permission = async (req) => {
  // Grant permission to your platform profile from another platform profile of yours.
  let { headers, db, body } = req;

  let { profile } = headers;
  let { third_party_token, session_token } = body;

  let third_party = await (
    await db.folder("Third_party_platforms")
  ).findOne({ _id: third_party_token });

  if (!third_party) {
    return {
      ok: false,
      message: "Invalid third party token",
      response_code: "invalid_third_party_token",
      status: 400,
    };
  }

  let Sessions = await db.folder("Sessions");
  let session = await Sessions.findOne({ token: session_token });
  if (!session) {
    return {
      ok: false,
      message: "Invalid session token",
      response_code: "invalid_session_code",
      status: 400,
    };
  }

  let Profiles = await db.folder("Profiles");
  let Platforms = await db.folder("Platforms");
  let session_platform = await Platforms.findOne({
    _id: third_party.owner_platform,
  });
  let session_profile = await Profiles.findOne({ _id: session.profile });
  let platform = await Platforms.findOne({ _id: profile.platform });

  let tokens = await handle_permissions_session({
    req,
    third_party,
    profile,
    session_platform,
    session_profile,
    platform,
  });

  return {
    ok: true,
    message: "Permissions handled",
    data: { tokens, profile },
  };
};

const get_permissions = async (req) => {
  // Retrieve permissions of a profile in a platform.

  let { headers, db } = req;
  let { profile } = headers;

  let permissions = get_settings({
    req,
    body: {
      category: profile.platform,
      key: "permissions",
    },
    profile: await get_platform_profile(req, { _id: profile.platform }),
    options: { full: true },
  });

  if (!permissions.ok) {
    return permissions;
  }

  permissions = permissions.data;

  let data = {};

  let Sessions = await db.folder("Sessions");
  for (let uri in permissions) {
    let profile_types = permissions[uri];

    let sess = await Sessions.find({
      profile_type: { $in: profile_types },
      platform_uri: uri,
      third_party_profile: profile._id,
    });

    data[uri] = new Array();
    for (let s = 0; sess.length; s++) {
      let ses = sess[s];
      data[uri].push({
        permitted: true,
        session: {
          token: ses.token,
          profile: ses.profile,
          profile_type: ses.profile_type,
          platform: ses.platform,
        },
      });
    }

    profile_types.map((p) => {
      if (!data[uri].find((s) => s.profile_type === p)) {
        data[uri].push({ profile_type: p, permitted: false, session: null });
      }
    });
  }

  return { ok: true, data, message: "Permissions read." };
};

const third_party_profile = async (req) => {
  // This endpoint is used by a platform profile to retrieve another profile of his that is authenticated into said platform.

  let { headers, db, body } = req;
  let { profile } = headers;
  let { third_party_profile } = body;

  let Sessions = await db.folder("Sessions");
  let sess = await Sessions.findOne({
    profile: profile._id,
    "third_party.profile": third_party_profile,
  });

  if (!sess) {
    return {
      ok: false,
      message: "Not authorised",
      status: 400,
    };
  }

  let Profiles = await db.folder("Profiles");
  let prof = await Profiles.findOne({ _id: third_party_profile });
  let profile_type = await (
    await db.folder("Profile_types")
  ).findOne({ _id: prof.profile });

  return {
    ok: true,
    message: "Your Third Party profile",
    data: { profile: prof, profile_type },
  };
};

export {
  register_third_party,
  authorise_third_party,
  refresh_third_party_token,
  get_token,
  third_party_profile,
  third_party_signin,
  get_third_parties_by_uri,
  third_party_signup,
  grant_permission,
  get_permissions,
  get_third_parties,
  get_third_party,
  get_third_party_registrations,
  get_third_party_registration,
  get_third_party_registrations_by_uri,
};
