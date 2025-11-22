import { PROFILES } from "../ds/folders.js";
import pagination from "../utils/pagination.js";

const user_profiles = async (req, res) => {
  let { email, skip } = req.body,
    limit = 20;
  skip = skip || 0;

  let Profiles = await PROFILES();
  let profiles = await Profiles.find({ email })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  res.json({
    ok: true,
    message: "Profiles retrieved",
    data: profiles,
    pagination: pagination(profiles, limit, skip),
  });
};

export { user_profiles };
