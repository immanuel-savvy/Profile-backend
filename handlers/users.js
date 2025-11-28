import { PROFILE_TYPES, PROFILES, SETTINGS } from "../ds/folders.js";
import pagination from "../utils/pagination.js";

const new_profile_type = async (req, res) => {
  let { platform } = req.query;
  let data = req.body;
  // type, name, description

  let Profile_types = await PROFILE_TYPES();

  let profile = await Profile_types.findOne({ type: data.type, platform });
  if (profile) {
    return res.json({
      ok: false,
      message: "Profile type already exist",
    });
  }

  let response = await Profile_types.insertOne({ ...data, platform });

  res.json({
    ok: true,
    message: "Profile Type Added!",
    data: { _id: response.insertedId, type: data.type },
  });
};

const update_profile_type = async (req, res) => {
  let { property, value, type, platform } = req.body;

  let Profile_types = await PROFILE_TYPES();

  let response = await Profile_types.updateOne(
    { type, platform },
    { $set: { [property]: value } }
  );

  res.json({
    ok: !!response.modifiedCount,
    message: !!response.modifiedCount
      ? "Profile updated"
      : "Profile not found!",
    data: { [property]: value },
  });
};

const get_profile_types = async (req, res) => {
  let { platform, skip } = req.body,
    limit = 20;
  skip = skip || 0;

  let Profile_types = await PROFILE_TYPES();

  let data = await Profile_types.find({ platform })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  res.json({
    ok: true,
    message: "Profile types retrieved",
    data,
    pagination: pagination(Profile_types, limit, skip),
  });
};

const get_profile_type = async (req, res) => {
  let { type, platform } = req.body;

  let Profile_types = await PROFILE_TYPES();

  let data = await Profile_types.findOne({ type, platform });

  res.json({
    ok: !!data,
    message: data ? "Profile type retrieved" : "Profile type not found",
    data,
  });
};

const get_profiles = async (req, res) => {
  let { profile, skip } = req.body,
    limit = 20;
  skip = skip || 0;

  let Profiles = await PROFILES();

  let data = await Profiles.find({ profile })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  res.json({
    ok: true,
    message: "Profile retrieved",
    data,
    pagination: pagination(Profiles, limit, skip),
  });
};

const settings = async (req, res) => {
  let { user, setting } = req.body;

  let result = await (
    await SETTINGS()
  ).updateOne({ _id: user }, { $set: setting }, { upsert: true });

  res.json({
    ok: !!(result.modifiedCount || result.upsertedCount),
    message: result.modifiedCount || result.upsertedCount ? "Done" : "Failed",
  });
};

const get_settings = async (req, res) => {
  let { user } = req.body;

  let setting = await (await SETTINGS()).findOne({ _id: user });

  res.json({
    ok: !!setting,
    message: setting ? "Setting retrieved" : "Not found",
    data: setting,
  });
};

export {
  settings,
  get_settings,
  new_profile_type,
  update_profile_type,
  get_profile_type,
  get_profile_types,
  get_profiles,
};
