import { PROFILE_TYPES } from "../ds/folders";

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

export { new_profile_type, update_profile_type };
