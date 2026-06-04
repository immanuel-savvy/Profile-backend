import { get_platform_profile } from "../profiles.js";

const get_settings = async ({ req, body, profile, options }) => {
  let { full } = options || {};

  if (!profile) {
    profile = await get_platform_profile(req);
  }
  let res = await (
    await req.services("settings")
  ).call("get_settings", body, profile && { profile });

  if (full) return res;

  return res?.data || {};
};

const pagination = async (folder, { limit, skip, query }) => {
  let total = query
    ? await folder.find(query).count()
    : await folder.countDocuments();

  return {
    page: skip / limit + 1,
    pages: Math.ceil(total / limit),
    skip,
    limit,
    total,
  };
};

export { get_settings, pagination };
