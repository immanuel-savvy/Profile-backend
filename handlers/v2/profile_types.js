import crypto from "crypto";
import { PROFILE_TYPES, PROFILES, USERS } from "../../ds/folders.js";

// ➕ Create
const create_profile_type = async (req, res) => {
  try {
    let platform = req.headers.platform;
    let { name, description, ...rest } = req.body;

    if (!name || !description) {
      return res.json({
        ok: false,
        message: "Name and description are required",
      });
    }

    const Types = await PROFILE_TYPES();

    // 🔍 Check uniqueness (per platform)
    let exist = await Types.findOne({
      name,
      platform: platform._id,
    });

    if (exist) {
      return res.json({
        ok: false,
        message: "Profile type with this name already exists",
      });
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

    return res.json({
      ok: true,
      message: "Profile type created",
      data: doc,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error",
    });
  }
};

// 📄 List all
const get_profile_types = async (req, res) => {
  try {
    let platform = req.headers.platform;

    const Types = await PROFILE_TYPES();

    let data = await Types.find({
      platform: platform._id,
    }).toArray();

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
};

// 🔍 Get single
const get_profile_type = async (req, res) => {
  try {
    let platform = req.headers.platform;
    let { name, _id } = req.body;

    const Types = await PROFILE_TYPES();

    let query = {
      platform: platform._id,
    };

    if (_id) query._id = _id;
    else if (name) query.name = name;
    else {
      return res.json({
        ok: false,
        message: "Provide _id or name",
      });
    }

    let data = await Types.findOne(query);

    if (!data) {
      return res.json({
        ok: false,
        message: "Profile type not found",
      });
    }

    return res.json({
      ok: true,
      message: "",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
};

// ✏️ Update
const update_profile_type = async (req, res) => {
  try {
    let platform = req.headers.platform;
    let { name, _id, description, ...rest } = req.body;

    const Types = await PROFILE_TYPES();

    let query = {
      platform: platform._id,
    };

    if (_id) query._id = _id;
    else if (name) query.name = name;
    else {
      return res.json({
        ok: false,
        message: "Provide id or name",
      });
    }

    // Optional: prevent duplicate name change
    if (rest.name) {
      let exist = await Types.findOne({
        name: rest.name,
        platform: platform._id,
      });

      if (exist) {
        return res.json({
          ok: false,
          message: "Another profile type with this name exists",
        });
      }
    }

    await Types.updateOne(query, {
      $set: {
        ...(description && { description }),
        ...rest,
        updated: new Date(),
      },
    });

    let updated = await Types.findOne(query);

    return res.json({
      ok: true,
      message: "Profile type updated",
      data: updated,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
};

const get_profiles = async (req, res) => {
  try {
    let { page = 1, limit = 20, profile, ids, search } = req.body;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 20;
    const skip = (page - 1) * limit;

    const Profiles = await PROFILES();

    const query = {};
    if (profile) query.profile = profile;
    if (ids && Array.isArray(ids)) query._id = { $in: ids };

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

    return res.json({
      ok: true,
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false });
  }
};

const get_profiles_by_id = async (req, res) => {
  let { _ids } = req.body;

  const Profiles = await PROFILES();

  let data = await Profiles.find({
    _id: { $in: _ids },
  }).toArray();

  return res.json({
    ok: true,
    data,
  });
};

export {
  create_profile_type,
  get_profile_types,
  get_profile_type,
  update_profile_type,
  get_profiles,
  get_profiles_by_id,
};
