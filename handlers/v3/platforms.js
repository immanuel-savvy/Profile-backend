const new_platform = async (req) => {
  let { db, headers, body } = req;
  let { profile } = headers;
  let { name, uri, description } = body;

  let platform = {
    name,
    uri,
    description,
    _id: crypto.randomUUID(),
    created: Date.now(),
    profile: profile._id,
  };
  let Platforms = await db.folder("Platforms");

  if (await Platforms.findOne({ uri })) {
    return {
      ok: false,
      status: 400,
      message: "Platform uri have been used",
    };
  }

  await Platforms.insertOne(platform);

  let token = crypto.randomBytes(48).toString("hex");

  await (
    await db.folder("Platform_tokens")
  ).insertOne({
    _id: crypto.randomUUID(),
    platform: platform._id,
    token,
    created: Date.now(),
  });

  return {
    ok: true,
    message: "Platform created",
    token,
    data: platform,
  };
};

const get_platform = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;

  let { uri, platform_id } = body;

  let query = { profile: profile._id };

  if (uri) query.uri = uri;
  else if (platform_id) query._id = platform_id;

  let Platforms = await db.folder("Platforms");
  let platform = await Platforms.findOne(query);

  if (!platform) {
    return {
      ok: false,
      status: 400,
      message: "Platform not found.",
    };
  }

  return {
    ok: true,
    message: "Platform retrieved",
    data: platform,
  };
};

const update_platform = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  let { uri, updates } = body;

  if (!updates || typeof updates !== "object") {
    return {
      ok: false,
      status: 400,
      message: "Invalid updates object",
    };
  }

  // remove disallowed fields if present
  ["uri", "created", "updated"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      delete updates[key];
    }
  });

  let Platforms = await db.folder("Platforms");
  let res = await Platforms.updateOne({ uri }, { $set: updates });

  if (
    !res ||
    (typeof res.matchedCount === "number" && res.matchedCount === 0)
  ) {
    return {
      ok: false,
      status: 400,
      message: "Platform not found.",
    };
  }

  // fetch current doc to return to caller
  let platform = await Platforms.findOne({ uri, profile: profile._id });

  // If driver doesn't provide modifiedCount, treat as success with returned doc
  const modified =
    typeof res.modifiedCount === "number" ? res.modifiedCount : null;

  if (modified === 0) {
    return {
      ok: true,
      message: "No changes made.",
      data: platform,
    };
  }

  return {
    ok: true,
    message: "Platform updated.",
    data: platform,
  };
};

const get_profile_platforms = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  let { page = 1, limit = 20 } = body || {};

  if (page < 1 || limit < 1) {
    return {
      ok: false,
      status: 400,
      message: "Invalid pagination parameters",
    };
  }

  // enforce an upper bound for safety
  limit = Math.min(limit, 100);

  let query = { profile: profile._id };

  let Platforms = await db.folder("Platforms");

  // attempt to get total count when supported
  let total = null;
  if (typeof Platforms.countDocuments === "function") {
    total = await Platforms.countDocuments(query);
  } else if (typeof Platforms.count === "function") {
    total = await Platforms.count(query);
  }

  let skip = (page - 1) * limit;
  let cursor = Platforms.find ? Platforms.find(query) : [];
  // sort by newest first when possible
  if (cursor && typeof cursor.sort === "function")
    cursor = cursor.sort({ created: -1 });
  if (cursor && typeof cursor.skip === "function") cursor = cursor.skip(skip);
  if (cursor && typeof cursor.limit === "function")
    cursor = cursor.limit(limit);

  let items;
  if (cursor && typeof cursor.toArray === "function") {
    items = await cursor.toArray();
  } else if (Array.isArray(cursor)) {
    items = cursor.slice(skip, skip + limit);
  } else {
    // fallback: try await directly (some drivers return a promise for array)
    items = await cursor;
  }

  return {
    ok: true,
    message: "Platforms retrieved",
    pagination: {
      total,
      limit,
      skip,
      page,
    },
    data: items,
  };
};

export { new_platform, get_platform, update_platform, get_profile_platforms };
