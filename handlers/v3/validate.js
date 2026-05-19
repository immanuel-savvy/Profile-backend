const validate = async (req) => {
  let { headers, db } = req;
  let api_key = headers["x-api-key"];

  let Platforms = await db.folder("Platforms");
  let Tokens = await db.folder("Tokens");

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
    data: platform,
  };
};

const me = async (req) => {
  let { headers, platform_db } = req;

  let x_platform = headers["x-platform"];
  let authorization = headers["authorization"];
  if (!authorization) {
    return {
      ok: false,
      message: "Authorization token is not found",
      status: 400,
    };
  } else authorization = authorization.replace("Bearer ", "");

  let Platforms = await platform_db.folder("Platforms");
  let platform = await Platforms.findOne({ uri: x_platform });

  let Sessions = await platform_db.folder("Sessions");
  let session = await Sessions.findOne({
    token: authorization,
    platform: platform._id,
  });

  let Profiles = await platform_db.folder("Profiles");
  let profile = await Profiles.findOne({ profile: session.profile });

  return {
    ok: true,
    message: "Valid",
    token: authorization,
    data: { profile },
  };
};
