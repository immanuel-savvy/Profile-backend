const validate = async (req) => {
  let { headers, db } = req;
  let api_key = headers["x-api-key"];

  if (api_key?.startsWith("o")) {
    let One_time_tokens = await db.folder("One_time_tokens");
    let split = api_key.split(".");
    api_key = split[0];

    let token_data = await One_time_tokens.findOne({ token: api_key });
    if (!token_data) {
      return {
        ok: false,
        message: "Token is not valid",
        status: 401,
      };
    }

    if (token_data.updated < Date.now() - token_data.duration) {
      await One_time_tokens.deleteOne({ _id: token_data._id });
      return {
        ok: false,
        message: "Token has expired",
        status: 401,
      };
    }

    if (token_data.limit === 0) {
      await One_time_tokens.deleteOne({ _id: token_data._id });
      return {
        ok: false,
        message: "Token has been used up",
        status: 401,
      };
    }

    if (
      token_data.endpoints?.length &&
      !token_data.endpoints.includes(split[1])
    ) {
      return {
        ok: false,
        message: "Unauthorised endpoint",
        status_code: "unauthorised_endpoint",
        status: 401,
      };
    }

    if (token_data?.limit !== -1) {
      let updated_token = await One_time_tokens.findOneAndUpdate(
        { _id: token_data._id },
        { $inc: { limit: -1 } },
        { returnDocument: "after" }, // MongoDB Driver v4+
      );

      if (updated_token.limit < -1) {
        await One_time_tokens.deleteOne({ _id: token_data._id });

        return {
          ok: false,
          message: "Invalid token",
          status: 400,
          status_code: "invalid_token",
        };
      }
    }

    let Identities = await db.folder("Profiles");
    let data = await Identities.findOne({ _id: token_data.profile });

    if (!data) {
      return {
        ok: false,
        message: "Api Key does not match any identity.",
        status: 401,
      };
    }

    return {
      ok: true,
      message: "Token valid",
      data: { profile: data },
    };
  }

  let is_profile = api_key.startsWith("p") && api_key.length > 20;

  let Identities = await db.folder(is_profile ? "Profiles" : "Platforms");
  let Tokens = await db.folder(
    is_profile ? "Profile_tokens" : "Platform_tokens",
  );

  let token_data = await Tokens.findOne({ token: api_key });
  if (!token_data) {
    return {
      ok: false,
      message: "Token is not valid",
      status: 401,
    };
  }

  let data = await Identities.findOne({
    _id: is_profile ? token_data.profile : token_data.platform,
  });

  if (!data) {
    return {
      ok: false,
      message: "Api Key does not match any identity.",
      status: 401,
    };
  }

  return {
    ok: true,
    message: "Token valid",
    data: { [is_profile ? "profile" : "platform"]: data },
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

  // if (session && session.created < Date.now() - 1000 * 60 * 60 * 24) {
  //   await Sessions.deleteOne({ _id: session._id });
  //   return {
  //     ok: false,
  //     status_code: "session_expired",
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
