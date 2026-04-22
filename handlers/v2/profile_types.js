import crypto from "crypto";

// ➕ Create
const create_profile_type = async (req) => {
  let db = req.db;
  let platform = req.headers.platform;
  let { name, description, ...rest } = req.body;

  const Types = await db.folder("profile_types");

  // 🔍 Check uniqueness (per platform)
  let exist = await Types.findOne({
    name,
    platform: platform._id,
  });

  if (exist) {
    return {
      ok: false,
      message: "Profile type with this name already exists",
    };
  }

  const doc = {
    _id: crypto.randomUUID(),
    name,
    description,
    platform: platform._id,
    created: new Date(),
    ...rest,
  };

  await Types.insertOne(doc);

  return {
    ok: true,
    message: "Profile type created",
    data: doc,
  };
};

// 📄 List all
const get_profile_types = async (req) => {
  let platform = req.headers.platform;
  let db = req.db;

  const Types = await db.folder("profile_types");

  let data = await Types.find({
    platform: platform._id,
  }).toArray();

  return {
    ok: true,
    data,
  };
};

// 🔍 Get single
const get_profile_type = async (req) => {
  let platform = req.headers.platform;
  let { name, _id } = req.body;
  let db = req.db;

  const Types = await db.folder("profile_types");

  let query = {
    platform: platform._id,
  };

  if (_id) query._id = _id;
  else if (name) query.name = name;
  else {
    return {
      ok: false,
      message: "Provide _id or name",
    };
  }

  let data = await Types.findOne(query);

  if (!data) {
    return {
      ok: false,
      message: "Profile type not found",
    };
  }

  return {
    ok: true,
    message: "",
    data,
  };
};

// ✏️ Update
const update_profile_type = async (req) => {
  let platform = req.headers.platform;
  let { _id, update } = req.body;
  let db = req.db;

  const Types = await db.folder("profile_types");

  let query = { _id };

  // Optional: prevent duplicate name change
  if (update.name) {
    let exist = await Types.findOne({
      name: update.name,
      platform: platform._id,
    });

    if (exist) {
      return {
        ok: false,
        message: "Another profile type with this name exists",
      };
    }
  }

  await Types.updateOne(query, {
    $set: {
      ...update,
      updated: new Date(),
    },
  });

  let updated = await Types.findOne(query);

  return {
    ok: true,
    message: "Profile type updated",
    data: updated,
  };
};

const get_profiles = async (req) => {
  let { page = 1, limit = 20, profile, search } = req.body;
  let db = req.db;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 20;
  const skip = (page - 1) * limit;

  const Profiles = await db.folder("profiles");

  const query = { profile };

  if (search && typeof search === "string" && search.trim()) {
    const s = search.trim();
    // escape user input for regex
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(esc, "i");
    query.$or = [
      { fullname: re },
      { name: re },
      { firstname: re },
      { lastname: re },
    ];
  }

  const total = await Profiles.countDocuments(query);
  const data = await Profiles.find(query)
    .sort({ created: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return {
    ok: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const get_profiles_by_id = async (req) => {
  let { _ids } = req.body;
  let db = req.db;

  const Profiles = await db.folder("profiles");

  let data = await Profiles.find({
    _id: { $in: _ids },
  }).toArray();

  return {
    ok: true,
    data,
  };
};

export {
  create_profile_type,
  get_profile_types,
  get_profile_type,
  update_profile_type,
  get_profiles,
  get_profiles_by_id,
};
