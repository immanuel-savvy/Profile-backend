const validate = async (req) => {
  let { headers, db } = req;
  let api_key = headers["x-api-key"];

  let Platforms = await db.folder("Platforms");
  let Tokens = await db.folder("Platform_tokens");

  let token_data = await Tokens.findOne({ token: api_key });
  if (!token_data) {
    return {
      ok: false,
      message: "Token is not valid",
      status: 401,
    };
  }

  let platform = await Platforms.findOne({ _id: token_data.platform });
  if (!platform) {
    return {
      ok: false,
      message: "Platform is missing",
      status: 401,
    };
  }

  return {
    ok: true,
    message: "Token valid",
    data: { platform },
  };
};

const me = async (req) => {
  let { headers, db } = req;

  let x_platform = headers["x-platform"];
  let authorization = headers["authorization"];

  if (!authorization) {
    return {
      ok: false,
      message: "Authorisation missing",
      status: 400,
    };
  } else authorization = authorization.replace("Bearer ", "");

  let Sessions = await db.folder("Sessions");
  let session = await Sessions.findOne({
    token: authorization,
    platform_uri: x_platform,
  });

  if (!session) {
    return {
      ok: false,
      status_code: "session_not_found",
      message: "Session not found",
      status: 401,
    };
  }

  // if (session && session.created < Date.now() - 1000 * 60 * 60 * 24) {
  //   await Sessions.deleteOne({ _id: session._id });
  //   return {
  //     ok: false,
  //     message: "Session expired",
  //     status: 401,
  //   };
  // }

  let Profiles = await db.folder("Profiles");
  let profile = await Profiles.findOne({ _id: session.profile });

  if (!profile) {
    return {
      ok: false,
      message: "Profile not found",
      status: 404,
    };
  }

  let Platforms = await db.folder("Platforms");

  return {
    ok: true,
    message: "Session valid",
    data: {
      profile,
      platform: await Platforms.findOne({ uri: session.platform_uri }),
    },
  };
};

const third_party_me = async (req) => {
  let { headers, db, body } = req;

  let xplatform = headers["x-platform"];
  let token = headers.authorization;

  let { from } = body;

  if (!token) {
    return {
      ok: false,
      message: "Authorisation missing",
      status: 400,
    };
  } else token = token.replace("Bearer ", "");

  let Sessions = await db.folder("Sessions");

  let session = await Sessions.findOne({
    token,
    platform_uri: xplatform,
    third_party_uri: from,
  });

  if (!session) {
    return {
      ok: false,
      status_code: "session_not_found",
      message: "Session not found",
      status: 401,
    };
  }

  if (session && session.created < Date.now() - 1000 * 60 * 60 * 24) {
    await Sessions.deleteOne({ _id: session._id });
    return {
      ok: false,
      status_code: "session_expired",
      message: "Session expired",
      status: 401,
    };
  }

  let Profiles = await db.folder("Profiles");
  let profile = await Profiles.findOne({ _id: session.profile });

  if (!profile) {
    return {
      ok: false,
      message: "Profile not found",
      status: 404,
    };
  }

  let Platforms = await db.folder("Platforms");
  let platform = await Platforms.findOne({
    _id: session.platform,
  });
  let third_party_platform = await Platforms.findOne({ uri: from });

  let Third_party_platforms = await db.folder("Third_party_platforms");
  let third_party = await Third_party_platforms.findOne({
    uri: from,
    owner_platform: platform._id,
  });

  return {
    ok: true,
    message: "Session valid",
    data: {
      profile,
      platform: platform,
      third_party,
      xplatform: third_party_platform,
    },
  };
};

export { validate, me, third_party_me };
