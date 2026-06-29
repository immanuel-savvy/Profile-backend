const refresh_platform_key = async (req) => {
  let { headers, db } = req;

  let { platform } = headers;

  let token = crypto.randomBytes(48).toString("hex");

  let Platform_tokens = await db.folder("Platform_tokens");

  await Platform_tokens.updateOne(
    {
      platform: platform._id,
    },
    {
      $set: {
        token,
        updated: Date.now(),
      },
      $setOnInsert: {
        created: Date.now(),
        _id,
      },
    },
    { upsert: true },
  );

  return {
    ok: true,
    message: "Token refreshed",
    data: {
      token,
      _id,
    },
  };
};

const refresh_profile_key = async (req) => {
  let { headers, db } = req;

  let { profile } = headers;
  let token = crypto.randomBytes(48).toString("hex");
  token = `p${token.slice(0, -1)}`;

  let Profile_tokens = await db.folder("Profile_tokens");

  let _id = crypto.randomUUID();
  await Profile_tokens.updateOne(
    {
      profile: profile._id,
    },
    {
      $set: {
        token,
        updated: Date.now(),
      },
      $setOnInsert: {
        created: Date.now(),
        _id,
      },
    },
    { upsert: true },
  );

  return {
    ok: true,
    message: "Token refreshed",
    data: {
      token,
      _id,
    },
  };
};

export { refresh_profile_key, refresh_platform_key };
