import crypto from "crypto";

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

  let { uri, permissions = [], platform_id, profile_type } = body;

  if (!uri && !platform_id) {
    return {
      ok: false,
      status: 400,
      message: "uri or platform_id required",
    };
  }

  let Third_party = await db.folder("Third_party_platforms");

  /**
   * =========================================================
   * DUPLICATE CHECK
   * =========================================================
   */

  let existing = await Third_party.findOne({
    owner_platform: platform._id,
    profile_type: profile_type || null,
    $or: [
      uri ? { uri } : null,
      platform_id
        ? {
            third_party_platform: platform_id,
          }
        : null,
    ].filter(Boolean),
  });

  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Third party already registered",
    };
  }

  let api_key = crypto.randomBytes(24).toString("hex");

  let third_party = {
    _id: crypto.randomUUID(),

    owner_platform: platform._id,

    third_party_platform: platform_id || null,

    profile_type,

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
      profile_type,

      permissions,
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

  let { platform } = headers;

  let { api_key, secret, auth_token } = body;

  if (!api_key || !secret || !auth_token) {
    return {
      ok: false,
      status: 400,
      message: "api_key, secret and auth_token required",
    };
  }

  /**
   * =========================================================
   * VALIDATE THIRD PARTY
   * =========================================================
   */

  let Third_party = await db.folder("Third_party_platforms");

  let integration = await Third_party.findOne({
    api_key,
    secret,

    enabled: true,
  });

  if (!integration) {
    return {
      ok: false,
      status: 401,
      message: "Invalid third party credentials",
    };
  }

  /**
   * =========================================================
   * VALIDATE SESSION
   * =========================================================
   */

  let Sessions = await db.folder("sessions");

  let source_session = await Sessions.findOne({
    token: auth_token,
    platform: integration.owner_platform,
  });

  if (!source_session) {
    return {
      ok: false,
      status: 401,
      message: "Invalid auth token",
    };
  }

  /**
   * =========================================================
   * PROFILE
   * =========================================================
   */

  let Profiles = await db.folder("profiles");

  let profile = await Profiles.findOne({
    _id: source_session.profile,
  });

  if (!profile) {
    return {
      ok: false,
      status: 404,
      message: "Profile not found",
    };
  }

  /**
   * =========================================================
   * CREATE SESSION
   * =========================================================
   */

  let session = {
    _id: crypto.randomUUID(),

    profile: profile._id,

    platform: platform._id,

    parent_platform: integration.owner_platform,

    third_party: true,

    token: crypto.randomBytes(48).toString("hex"),

    created: Date.now(),
  };

  await Sessions.insertOne(session);

  /**
   * =========================================================
   * AUDIT LOG
   * =========================================================
   */

  let Third_party_logs = await db.folder("Third_party_logs");

  await Third_party_logs.insertOne({
    _id: crypto.randomUUID(),

    integration: integration._id,

    profile: profile._id,

    source_platform: integration.owner_platform,

    destination_platform: platform._id,

    session: session._id,

    created: Date.now(),
  });

  return {
    ok: true,
    status: 200,
    message: "Third party authorisation successful",

    data: {
      token: session.token,

      profile,
    },
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

  let { token, api_key, secret } = body;

  if (!token || !api_key || !secret) {
    return {
      ok: false,
      status: 400,
      message: "token, api_key and secret required",
    };
  }

  /**
   * =========================================================
   * VALIDATE INTEGRATION
   * =========================================================
   */

  let Third_party = await db.folder("Third_party_platforms");

  let integration = await Third_party.findOne({
    api_key,
    secret,

    enabled: true,
  });

  if (!integration) {
    return {
      ok: false,
      status: 401,
      message: "Invalid integration credentials",
    };
  }

  /**
   * =========================================================
   * VALIDATE SESSION
   * =========================================================
   */

  let Sessions = await db.folder("sessions");

  let session = await Sessions.findOne({
    token,

    third_party: true,

    platform: platform._id,
  });

  if (!session) {
    return {
      ok: false,
      status: 401,
      message: "Invalid session token",
    };
  }

  /**
   * =========================================================
   * ROTATE TOKEN
   * =========================================================
   */

  let new_token = crypto.randomBytes(48).toString("hex");

  await Sessions.updateOne(
    {
      _id: session._id,
    },
    {
      $set: {
        token: new_token,
        updated: Date.now(),
      },
    },
  );

  return {
    ok: true,
    status: 200,
    message: "Third party token refreshed",

    data: {
      token: new_token,
    },
  };
};

export {
  register_third_party,
  authorise_third_party,
  refresh_third_party_token,
};
