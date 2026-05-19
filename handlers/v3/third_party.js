import crypto from "crypto";
import { create_session_object } from "./profiles.js";

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

  if (!uri) {
    return {
      ok: false,
      status: 400,
      message: "uri required",
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
    uri,
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

  let { third_party_token, platform_uri, session_token } = body;

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

  if (integration.owner_platform_uri !== platform_uri) {
    return {
      ok: false,
      status: 401,
      message: "Third party token not valid for this platform",
    };
  }
  if (integration.uri !== platform.uri) {
    return {
      ok: false,
      status: 401,
      message: "Third party token does not belong to this platform",
    };
  }

  let Sessions = await db.folder("sessions");

  let session = await Sessions.findOne({
    token: session_token,

    platform_uri,
  });

  if (!session) {
    return {
      ok: false,
      status: 401,
      message: "Invalid session token",
    };
  }

  // if (session.created )

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

  let Platforms = await db.folder("Platforms");

  let xplatform = await Platforms.findOne({ uri: platform_uri });

  let response_session = await create_session_object(
    session_profile,
    xplatform,
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

export {
  register_third_party,
  authorise_third_party,
  refresh_third_party_token,
  get_token,
};
