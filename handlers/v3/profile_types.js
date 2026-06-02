import crypto from "crypto";

const create_profile_type = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;

  let { name, type, description } = body;

  let Profile_types = await db.folder("Profile_types");

  if (
    await Profile_types.findOne({
      type,
      platform: platform._id,
    })
  ) {
    return {
      ok: false,
      status: 400,
      message: "Profile type already exists",
    };
  }

  let profile_type = {
    _id: crypto.randomUUID(),

    name,
    type,
    description,

    platform: platform._id,
    profile: platform.profile,

    created: Date.now(),
  };

  await Profile_types.insertOne(profile_type);

  return {
    ok: true,
    message: "Profile type created",
    data: profile_type,
  };
};

const get_profile_types = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;
  console.log(platform, "uhh", body);
  let { limit, page } = body;

  let skip = 0;
  if (page && limit) {
    skip = (page - 1) * limit;
  }
  let Profile_types = await db.folder("Profile_types");

  let profile_types = await Profile_types.find({
    platform: platform._id,
  })
    .skip(skip)
    .limit(limit)
    .toArray();

  return {
    ok: true,
    status: 200,
    data: profile_types,
  };
};

const get_profile_type = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;

  let { profile_type_id, type } = body;

  let Profile_types = await db.folder("Profile_types");

  let query = {
    platform: platform._id,
  };

  if (profile_type_id) {
    query._id = profile_type_id;
  }

  if (type) {
    query.type = type;
  }

  let profile_type = await Profile_types.findOne(query);

  if (!profile_type) {
    return {
      ok: false,
      status: 404,
      message: "Profile type not found",
    };
  }

  return {
    ok: true,
    status: 200,
    data: profile_type,
  };
};

const update_profile_type = async (req) => {
  let { headers, db, body } = req;

  let { platform } = headers;

  let { profile_type_id, updates = {} } = body;

  let Profile_types = await db.folder("Profile_types");

  let existing = await Profile_types.findOne({
    _id: profile_type_id,
    platform: platform._id,
  });

  if (!existing) {
    return {
      ok: false,
      status: 404,
      message: "Profile type not found",
    };
  }

  const protected_fields = ["_id", "platform", "profile", "created"];

  for (let field of protected_fields) {
    delete updates[field];
  }

  if (updates.type && updates.type !== existing.type) {
    let duplicate = await Profile_types.findOne({
      type: updates.type,
      platform: platform._id,
    });

    if (duplicate) {
      return {
        ok: false,
        status: 409,
        message: "Profile type already exists",
      };
    }
  }

  if (Object.keys(updates).length === 0) {
    return {
      ok: false,
      status: 400,
      message: "No valid fields to update",
    };
  }

  await Profile_types.updateOne(
    {
      _id: profile_type_id,
    },
    {
      $set: {
        ...updates,
        updated: Date.now(),
      },
    },
  );

  let updated = await Profile_types.findOne({
    _id: profile_type_id,
  });

  return {
    ok: true,
    status: 200,
    message: "Profile type updated",
    data: updated,
  };
};

export {
  create_profile_type,
  get_profile_types,
  get_profile_type,
  update_profile_type,
};
