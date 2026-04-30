const validate = async (req) => {
  const headers = req.headers || {};

  console.log(headers);
  const api_key = headers["x-api-key"];
  if (!api_key) {
    return { ok: false, message: "API key is required", status: 403 };
  }

  let authorisation = headers["authorization"];
  if (authorisation) {
    authorisation = authorisation.replace("Bearer ", "");
  }

  const db = req.db;

  const Tokens = await db.folder("Tokens");
  const pload = await Tokens.findOne({ token: api_key });

  if (!pload) {
    return { ok: false, message: "Invalid API key", status: 403 };
  }

  const Users = await db.folder("Users");
  const platform = await Users.findOne({ _id: pload.user });

  if (!platform) {
    return { ok: false, message: "Platform not found", status: 403 };
  }

  let profile = null,
    sess;

  if (authorisation) {
    const Sessions = await db.folder("Sessions");

    sess = await Sessions.findOne({
      platform: platform._id,
      token: authorisation,
    });

    if (!sess) {
      return {
        ok: false,
        message: "Invalid authorization token",
        status: 403,
      };
    }

    if (sess.expiry && new Date(sess.expiry) < new Date()) {
      await Sessions.deleteOne({ _id: sess._id });

      return {
        ok: false,
        message: "Session expired",
        status: 403,
      };
    }

    const Profiles = await db.folder("profiles");
    profile = await Profiles.findOne({ _id: sess.user });

    if (!profile) {
      return {
        ok: false,
        message: "Profile not found",
        status: 403,
      };
    }
  }

  return {
    ok: true,
    message: "Validation successful",
    data: {
      profile,
      expiry: sess?.expiry,
      platform,
    },
  };
};

const validate_third_party = async (req) => {
  const headers = req.headers || {};

  const api_key = headers["x-api-key"];
  if (!api_key) {
    return { ok: false, message: "API key is required", status: 403 };
  }

  let authorisation = headers["authorization"];
  if (authorisation) {
    authorisation = authorisation.replace("Bearer ", "");
  }

  const { xplatform } = req.body || {};
  if (!xplatform) {
    return {
      ok: false,
      message: "xplatform is required",
      status: 400,
    };
  }

  const db = req.db;

  const Platforms = await db.folder("Users");

  const x_platform = await Platforms.findOne({ uri: xplatform });
  if (!x_platform) {
    return {
      ok: false,
      message: "Invalid xplatform",
      status: 403,
    };
  }

  const Tokens = await db.folder("Tokens");
  const pload = await Tokens.findOne({ token: api_key });

  if (!pload) {
    return { ok: false, message: "Invalid API key", status: 403 };
  }

  const platform = await Platforms.findOne({ _id: pload.user });
  if (!platform) {
    return {
      ok: false,
      message: "Platform not found",
      status: 403,
    };
  }

  if (!authorisation) {
    return {
      ok: false,
      message: "Authorization token required",
      status: 403,
    };
  }

  const Sessions = await db.folder("Sessions");

  const sess = await Sessions.findOne({
    platform: platform._id,
    token: authorisation,
    third_party_platform: x_platform._id,
  });

  if (!sess) {
    return {
      ok: false,
      message: "Invalid session for third party platform",
      status: 403,
    };
  }

  if (sess.expiry && new Date(sess.expiry) < new Date()) {
    await Sessions.deleteOne({ _id: sess._id });

    return {
      ok: false,
      message: "Session expired",
      status: 403,
    };
  }

  const Profiles = await db.folder("profiles");
  const profile = await Profiles.findOne({ _id: sess.user });

  if (!profile) {
    return {
      ok: false,
      message: "Profile not found",
      status: 403,
    };
  }

  return {
    ok: true,
    message: "Validation successful",
    data: {
      profile,
      xplatform: x_platform,
      platform,
      expiry: sess.expiry,
    },
  };
};

export { validate, validate_third_party };
