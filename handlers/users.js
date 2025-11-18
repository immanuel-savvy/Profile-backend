import { PROFILE_TYPES, PROFILES } from "../ds/folders";
import pagination from "../utils/pagination";

const new_profile_type = async (req, res) => {
  let { user, type, data } = req.body;

  let Profile_types = await PROFILE_TYPES(user);

  let profile = await Profile_types.findOne({ type });
  if (profile) {
    return res.json({
      ok: false,
      message: "Profile type already exist",
    });
  }

  let response = await Profile_types.insertOne({ ...data, type });

  res.json({
    ok: true,
    message: "Profile Type Added!",
    data: { _id: response.insertedId, type },
  });
};

const update_profile_type = async (req, res) => {
  let { property, value, type, user } = req.body;

  let Profile_types = await PROFILE_TYPES(user);

  let response = await Profile_types.updateOne(
    { type },
    { $set: { [property]: value } }
  );

  res.json({
    ok: !!response.modifiedCount,
    message: response.modifiedCount ? "Profile updated" : "Profile not found!",
    data: { [property]: value },
  });
};

const get_profile_types = async (req, res) => {
  let { user, skip } = req.body,
    limit = 20;
  skip = skip || 0;

  let Profile_types = await PROFILE_TYPES(user);

  let data = await Profile_types.find({})
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
  let { type, user } = req.body;

  let Profile_types = await PROFILE_TYPES(user);

  let data = await Profile_types.findOne({ type });

  res.json({
    ok: !!data,
    message: data ? "Profile type retrieved" : "Profile type not found",
    data,
  });
};

const get_profiles = async (req, res) => {
  let { type, user, skip } = req.body,
    limit = 20;
  skip = skip || 0;

  let Profiles = await PROFILES(user, type);

  let data = await Profiles.find({})
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

export {
  new_profile_type,
  update_profile_type,
  get_profile_type,
  get_profile_types,
  get_profiles,
};
