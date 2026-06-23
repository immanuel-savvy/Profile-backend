const get_settings = async ({ req, body, profile, options }) => {
  let { full } = options || {};

  if (!profile) {
    profile = req.headers?.platform?.profile;
    if (!profile) {
      return {};
    }
  } else {
    profile = profile?._id || profile;
  }

  if (!body.category) body.category = [];

  body.category.push("general");

  console.log(profile);

  let res = await (
    await req.services("settings")
  ).call("get_settings", body, profile && { profile });

  console.log(res, "hmmm");
  if (res.ok) {
    const categories = Object.keys(res.data || {});

    if (categories.includes("general")) {
      for (const category of body.category) {
        res.data[category] = {
          ...res.data.general,
          ...res.data[category],
        };
      }
    }

    const nonGeneralCategories = body.category.filter((c) => c !== "general");

    if (nonGeneralCategories.length === 1) {
      res.data = res.data[nonGeneralCategories[0]];
    }
  }

  console.log(JSON.stringify(res, null, 2));

  if (full) return res;

  return res?.data || {};
};

const deepMerge = (base, override) => {
  if (!base || typeof base !== "object") return override;
  if (!override || typeof override !== "object") return base;

  const result = { ...base };

  for (const key of Object.keys(override)) {
    if (
      typeof base[key] === "object" &&
      typeof override[key] === "object" &&
      !Array.isArray(base[key]) &&
      !Array.isArray(override[key])
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }

  return result;
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
