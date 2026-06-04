import crypto from "crypto";
import { get_settings } from "./helpers/settings.js";
import { hash } from "../../utils/hash.js";

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

const get_profiles = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;
  let { profile_type, limit, page } = body;

  let Profile_types = await db.folder("Profile_types");
  let Profiles = await db.folder("Profiles");

  let ptype = await Profile_types.findOne({
    _id: profile_type,
    platform: platform._id,
  });

  if (!ptype) {
    return {
      ok: false,
      message: "Invalid profile type",
      status: 400,
    };
  }

  let profiles = await Profiles.find({ profile: ptype._id })
    .limit(limit)
    .skip(limit * (page - 1))
    .toArray();

  return {
    ok: true,
    message: "Profiles retrieved",
    data: profiles,
  };
};

const add_profile = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;

  let { details, profile_type, password } = body;

  let ptype = await (
    await db.folder("Profile_types")
  ).findOne({ _id: profile_type, platform: platform._id });
  if (!ptype) {
    return {
      ok: false,
      message: "Invalid profile type",
      status: 401,
    };
  }
  let settings = await get_settings({
    req,
    body: { category: [profile_type], key: ["identity", "signup"] },
  });

  let identity_settings = settings?.[profile_type]?.identity;

  if (!identity_settings) {
    // Default to email if not specified
    identity_settings = {
      [profile_type]: {
        uniques: ["email"],
      },
    }[profile_type];
  } else identity_settings = identity_settings[profile_type];

  let Profiles = await db.folder("Profiles");
  if (
    !Array.isArray(identity_settings.uniques) ||
    identity_settings.uniques.length === 0
  ) {
    return {
      ok: false,
      status: 400,
      message: "No unique identity fields configured",
    };
  }
  for (let field of identity_settings.uniques) {
    if (!details[field]) {
      return {
        ok: false,
        status: 400,
        message: `Missing unique field: ${field}`,
      };
    }
  }

  // Verify none of the unique identity values are already used for this profile type
  const or = identity_settings.uniques.map((field) => ({
    [field]: details[field],
  }));
  const existing = await Profiles.findOne({ profile: profile_type, $or: or });
  if (existing) {
    return {
      ok: false,
      status: 409,
      message: "Identity already in use",
      data: { profile_id: existing._id, details: or },
    };
  }

  let new_profile = {
    _id: crypto.randomUUID(),
    profile: profile_type,
    platform: platform._id,
    ...details,
    created: Date.now(),
    agent: "admin",
  };

  await Profiles.insertOne(new_profile);

  let Profile_passwords = await db.folder("Profile_passwords");

  await Profile_passwords.insertOne({
    _id: crypto.randomUUID(),
    profile: new_profile._id,
    key: hash(password),
    created: Date.now(),
  });

  return {
    ok: true,
    message: "Profile added successfully",
    status: 201,
    data: new_profile,
  };
};

const edit_profile = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;

  let { profile_type, profile_id, update: details } = body;

  let Profile_types = await db.folder("Profile_types");
  let ptype = await Profile_types.findOne({
    _id: profile_type,
    platform: platform._id,
  });

  if (!ptype) {
    return {
      ok: false,
      message: "Invalid profile type",
      status: 400,
    };
  }

  let Profiles = await db.folder("Profiles");

  delete details.profile;
  delete details.platform;
  delete details._id;
  delete details.agent;

  let ress = await Profiles.updateOne(
    { _id: profile_id, profile: ptype._id },
    { $set: details },
  );
  if (
    !ress ||
    (typeof ress.matchedCount !== "undefined" && ress.matchedCount === 0)
  ) {
    return {
      ok: false,
      status: 404,
      message: "Profile not found",
    };
  }

  let data = await Profiles.findOne({ _id: profile_id });

  return {
    ok: true,
    message: "Profile updated",
    data,
  };
};

export {
  get_profiles,
  create_profile_type,
  get_profile_types,
  get_profile_type,
  update_profile_type,
  edit_profile,
  add_profile,
};
