import crypto from "crypto";
import { create_session_object } from "./helpers/profiles.js";
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

const register_third_party = async (req, opts = {}) => {
  let { target_platform, by } = opts || {};
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
  let permission_uris = Array.from(Object.keys(permissions));
  let plats = await Platforms.find({ uri: { $in: permission_uris } }).toArray();
  if (plats?.length !== permission_uris.length) {
    const foundUris = (plats || []).map((p) => p.uri);
    const invalidUris = permission_uris.filter((u) => !foundUris.includes(u));

    return {
      ok: false,
      status: 400,
      message: `Invalid permission platform URIs: ${invalidUris.join(", ")}`,
      data: { invalid_uris: invalidUris },
    };
  }

  target_platform = target_platform || (await Platforms.findOne({ uri }));

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

    uri,

    target_platform: target_platform._id,

    permissions,

    api_key,

    enabled: true,

    created: Date.now(),
  };

  if (by) third_party.by = by;

  await Third_party.insertOne(third_party);

  let permitting = new Array();
  for (let t_uri in permissions) {
    let t_platform = plats.find((p) => p.uri === t_uri);

    let res = await register_third_party(
      {
        ...req,
        headers: { platform: t_platform },
        body: {
          uri,
          profile_types,
          permissions: {},
        },
      },
      { target_platform, by: platform._id },
    );
    if (res.ok) permitting.push(res.data);
  }

  return {
    ok: true,
    message: "Third party registered",
    data: {
      _id: third_party._id,

      api_key,
      profile_types,

      permissions,
      permitting,
    },
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

  // if (integration.uri !== platform.uri) {
  //   return {
  //     ok: false,
  //     status: 401,
  //     message: "Third party token does not belong to this platform",
  //   };
  // }

  let Sessions = await db.folder("Sessions");

  let session = await Sessions.findOne({
    token: session_token,
    platform_uri: integration_platform.uri,
  });

  if (!session) {
    return {
      ok: false,
      status: 401,
      status_code: "invalid_session",
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
        _id: platform._id,
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

  console.log("get_token called with body:", body, headers);
  let { profile, platform_uri } = body;

  let Sessions = await db.folder("Sessions");

  let session = await Sessions.findOne({
    third_party_profile: profile,
    third_party_id: platform._id,
    platform_uri,
  });

  if (!session) {
    return {
      ok: false,
      status_code: "session_not_found",
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
              _id: platform._id,
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

  let platform = await (
    await db.folder("Platforms")
  ).findOne({ _id: profile.platform });

  let permissions = await get_settings({
    req,
    body: {
      category: [profile.platform],
      key: "permissions",
    },
    profile: platform.profile,
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
    }).toArray();

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

const update_third_party_permissions = async (req) => {
  let { db, headers, body } = req;

  let { platform } = headers;

  let { token, permissions = {} } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let Platforms = await db.folder("Platforms");

  let t_uris = Object.keys(permissions);
  let t_platforms = await Platforms.find({ uri: { $in: t_uris } }).toArray();
  if (t_platforms.length !== t_uris.length) {
    return {
      ok: false,
      message: "Confirm all uris are valid",
      status: 400,
    };
  }

  let third_party = await Third_party_platforms.findOne({
    owner_platform: platform._id,
    api_key: token,
  });

  if (!third_party) {
    return {
      ok: false,
      message: "Invalid creds",
      status: 403,
    };
  }

  await Third_party_platforms.updateOne(
    { _id: third_party._id },
    { $set: { permissions: { ...third_party.permissions, ...permissions } } },
  );

  let target_platform = await Platforms.findOne({
    _id: third_party.target_platform,
  });

  let permitting = new Array();
  for (let uri in permissions) {
    let t_platform = t_platforms.find((t) => t.uri === uri);

    let res = await register_third_party(
      {
        ...req,
        headers: { platform: t_platform },
        body: {
          uri: target_platform.uri,
          profile_types: third_party.profile_types,
        },
      },
      { target_platform, by: platform._id },
    );

    res?.ok && permitting.push(res);
  }

  return {
    ok: true,
    message: "Updated third party permissions",
    data: { permitting, profile_types: third_party.profile_types, permissions },
  };
};

const get_registrations = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;
  let { limit, page } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");
  let thirds = await Third_party_platforms.find({
    target_platform: platform._id,
  })
    .limit(limit)
    .skip(limit * (page - 1))
    .toArray();

  return {
    ok: true,
    message: "Retrieved",
    data: thirds,
  };
};

const get_registration_by_owner_uri = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;
  let { owner_uri } = body;

  let Platforms = await db.folder("Platforms");
  let owner_platform = await Platforms.findOne({ uri: owner_uri });

  if (!owner_platform) {
    return {
      ok: false,
      message: "Invalid owner uri",
      status: 400,
    };
  }

  let Third_party_platforms = await db.folder("Third_party_platforms");
  let third = await Third_party_platforms.findOne({
    target_platform: platform._id,
    owner_platform: owner_platform._id,
  });

  return {
    ok: true,
    message: "Retrieved",
    data: third,
  };
};

const get_registered_third_parties = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;
  let { limit, page } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");
  let thirds = await Third_party_platforms.find({
    owner_platform: platform._id,
  })
    .limit(limit)
    .skip(limit * (page - 1))
    .toArray();

  return {
    ok: true,
    message: "Retrieved",
    data: thirds,
  };
};

const get_registered_third_party = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;
  let { uri } = body;

  let target_platform = await (await db.folder("Platforms")).findOne({ uri });
  if (!target_platform) {
    return {
      ok: false,
      message: "Invalid target uri",
      status: 400,
    };
  }
  let Third_party_platforms = await db.folder("Third_party_platforms");
  let third = await Third_party_platforms.findOne({
    owner_platform: platform._id,
    target_platform: target_platform._id,
  });

  return {
    ok: true,
    message: "Retrieved",
    data: third,
  };
};

const get_profile_authorised_third_parties = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;

  let { limit = 20, page = 1 } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let Sessions = await db.folder("Sessions");

  let thirds = await Third_party_platforms.find({
    owner_platform: profile.platform,
  }).toArray();

  if (!thirds.length) {
    return {
      ok: true,
      message: "No authorised third parties",
      data: {
        profiles: [],
        platforms: [],
        profile_types: [],
        sessions: [],
      },
    };
  }

  let sessions = await Sessions.find({
    platform: {
      $in: thirds.map((t) => t.target_platform),
    },
    third_party_profile: profile._id,
  })
    .limit(limit)
    .skip((page - 1) * limit)
    .toArray();

  let Profiles = await db.folder("Profiles");
  let Profile_types = await db.folder("Profile_types");
  let Platforms = await db.folder("Platforms");

  let [profiles, profile_types, platforms] = await Promise.all([
    Profiles.find({
      _id: {
        $in: sessions.map((s) => s.profile),
      },
    }).toArray(),

    Profile_types.find({
      _id: {
        $in: sessions.map((s) => s.profile_type),
      },
    }).toArray(),

    Platforms.find({
      _id: {
        $in: sessions.map((s) => s.platform),
      },
    }).toArray(),
  ]);

  return {
    ok: true,
    message: "Authorised",
    data: {
      sessions,
      profiles,
      platforms,
      profile_types,
    },
  };
};

const get_profile_unauthorised_third_parties = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;

  let { limit = 20, page = 1 } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  let Sessions = await db.folder("Sessions");

  let thirds = await Third_party_platforms.find({
    owner_platform: profile.platform,
  }).toArray();

  if (!thirds.length) {
    return {
      ok: true,
      message: "No third parties registered",
      data: [],
    };
  }

  let sessions = await Sessions.find({
    platform: {
      $in: thirds.map((t) => t.target_platform),
    },
    third_party_profile: profile._id,
  }).toArray();

  let authorised_platforms = new Set(sessions.map((s) => s.platform));

  let unauthorised = thirds.filter(
    (t) => !authorised_platforms.has(t.target_platform),
  );

  let Platforms = await db.folder("Platforms");

  let platforms = await Platforms.find({
    _id: {
      $in: unauthorised.map((u) => u.target_platform),
    },
  })
    .limit(limit)
    .skip((page - 1) * limit)
    .toArray();

  let ptypes = [];
  unauthorised.map((u) => ptypes.push(...u.profile_types));

  return {
    ok: true,
    message: "Response",
    data: {
      third_parties: unauthorised,
      platforms,
      profile_types: await (await db.folder("Profile_types"))
        .find({ _id: { $in: ptypes } })
        .toArray(),
    },
  };
};

export {
  register_third_party,
  authorise_third_party,
  refresh_third_party_token,
  grant_permission,
  update_third_party_permissions,
  third_party_profile,
  get_token,

  //
  get_permissions,
  get_registration_by_owner_uri,
  get_registrations,

  //
  get_registered_third_parties,
  get_registered_third_party,

  //
  get_profile_authorised_third_parties,
  get_profile_unauthorised_third_parties,
};
