import crypto from "crypto";

const refresh_platform_key = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;
  let { name } = body;

  let token = crypto.randomBytes(48).toString("hex");

  let Platform_tokens = await db.folder("Platform_tokens");

  await Platform_tokens.updateOne(
    {
      platform: platform._id,
    },
    {
      $set: {
        name,
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
  let { headers, db, body } = req;

  let { profile } = headers;
  let { name } = body;

  let token = crypto.randomBytes(48).toString("hex");
  token = `p${token.slice(0, -1)}`;

  let Profile_tokens = await db.folder("Profile_tokens");

  let existing = await Profile_tokens.findOne({ profile: profile._id });

  let _id = existing?._id || crypto.randomUUID();

  await Profile_tokens.updateOne(
    { profile: profile._id },
    {
      $set: {
        name,
        token,
        updated: Date.now(),
      },
      $setOnInsert: {
        _id,
        profile: profile._id,
        created: Date.now(),
      },
    },
    {
      upsert: true,
    },
  );

  return {
    ok: true,
    message: existing ? "Token refreshed" : "Token created",
    data: {
      token,
      _id,
    },
  };
};

const create_profile_key = async (req) => {
  let { headers, db, body } = req;

  let { profile } = headers;
  let { name } = body;
  let token = crypto.randomBytes(48).toString("hex");
  token = `p${token.slice(0, -1)}`;

  let Profile_tokens = await db.folder("Profile_tokens");

  if (await Profile_tokens.findOne({ name, profile: profile._id })) {
    return {
      ok: false,
      message: "Key name already in use.",
      status: 401,
    };
  }

  let _id = crypto.randomUUID();
  await Profile_tokens.insertOne({
    profile: profile._id,

    name,
    token,
    updated: Date.now(),

    created: Date.now(),
    _id,
  });

  return {
    ok: true,
    message: "Token created",
    data: {
      token,
      _id,
    },
  };
};

const generate_ott = async (req) => {
  let { headers, db, body } = req;

  let { profile } = headers;
  let { limit, duration, endpoints, name } = body;

  let token = crypto.randomBytes(48).toString("hex");
  token = `o${token.slice(0, -1)}`;

  let One_time_tokens = await db.folder("One_time_tokens");

  let _id = crypto.randomUUID();
  await One_time_tokens.updateOne(
    {
      profile: profile._id,
    },
    {
      $set: {
        name,
        token,
        updated: Date.now(),
        limit,
        duration,
        endpoints,
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
    message: "Token generated",
    data: {
      token,
      _id,
    },
  };
};

const refresh_ott = async (req) => {
  let { headers, db } = req;

  let { profile } = headers;
  let { token, limit, duration, endpoints } = body;

  let One_time_tokens = await db.folder("One_time_tokens");

  let _id = crypto.randomUUID();
  await One_time_tokens.updateOne(
    {
      profile: profile._id,
      token: token,
    },
    {
      $set: {
        limit,
        duration,
        endpoints,
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

const revoke_ott = async (req) => {
  let { headers, db } = req;

  let { profile } = headers;
  let { token } = body;

  let One_time_tokens = await db.folder("One_time_tokens");

  await One_time_tokens.deleteOne({
    profile: profile._id,
    token: token,
  });

  return {
    ok: true,
    message: "Token revoked",
  };
};

const retrieve_profile_keys = async (req) => {
  let { headers, db, body } = req;

  let { profile } = headers;
  let { limit, page } = body;

  let Profile_tokens = await db.folder("Profile_tokens");

  let tokens = await Profile_tokens.find({ profile: profile._id })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray();

  return {
    ok: true,
    message: "Keys retrieved",
    data: tokens,
  };
};

const retrieve_profile_key = async (req) => {
  let { headers, db, body } = req;

  let { profile } = headers;
  let { name, token } = body;

  let Profile_tokens = await db.folder("Profile_tokens");

  let query = { profile: profile._id };
  if (name) query.name = name;
  if (token) query.token = token;

  let token_data = await Profile_tokens.findOne(query);

  return {
    ok: !!token_data,
    message: token_data ? "Token retrieved" : "No token",
    data: token_data,
  };
};

const revoke_profile_key = async (req) => {
  let { headers, db, body } = req;

  let { profile } = headers;
  let { name, token } = body;

  let Profile_tokens = await db.folder("Profile_tokens");

  let query = { profile: profile._id };
  if (name) query.name = name;
  if (token) query.token = token;

  let result = await Profile_tokens.deleteOne(query);

  return {
    ok: result.deletedCount >= 1,
    message: result.deletedCount ? "Key revoked" : "No keys revoked",
  };
};

const retrieve_platform_keys = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;
  let { limit, page } = body;

  let Platform_tokens = await db.folder("Platform_tokens");

  let tokens = await Platform_tokens.find({ platform: platform._id })
    .limit(limit)
    .skip((page - 1) * limit)
    .toArray();

  return {
    ok: true,
    message: "Keys retrieved",
    data: tokens,
  };
};

const retrieve_platform_key = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;
  let { name, token } = body;

  let Platform_tokens = await db.folder("Platform_tokens");

  let query = { platform: platform._id };
  if (name) query.name = name;
  if (token) query.token = token;

  let token_data = await Platform_tokens.findOne(query);

  return {
    ok: !!token_data,
    message: token_data ? "Token retrieved" : "No token",
    data: token_data,
  };
};

const revoke_platform_key = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;
  let { name, token } = body;

  let Platform_tokens = await db.folder("Platform_tokens");

  let query = { platform: platform._id };
  if (name) query.name = name;
  if (token) query.token = token;

  let result = await Platform_tokens.deleteOne(query);

  return {
    ok: result.deletedCount >= 1,
    message: result.deletedCount ? "Key revoked" : "No keys revoked",
  };
};

export {
  refresh_profile_key,
  refresh_platform_key,
  generate_ott,
  refresh_ott,
  revoke_ott,
  revoke_profile_key,
  retrieve_profile_key,
  retrieve_profile_keys,
  create_profile_key,
  retrieve_platform_key,
  revoke_platform_key,
  retrieve_platform_keys,
};
