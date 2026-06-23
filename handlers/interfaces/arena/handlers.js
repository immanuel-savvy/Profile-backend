const get_profile_list_items = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  let { list, page, limit } = body;

  let Platforms = await db.folder("Platforms");
  let profile_type = await (
    await db.folder("Profile_types")
  ).findOne({ _id: profile.profile });
  if (list === "platforms") {
    let platforms = await Platforms.find({ profile: profile._id })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    let platform_to_post = new Array();
    for (let platform of platforms) {
      let pst = {};
      pst._id = platform._id;
      pst.created = platform.created;
      pst.title = {
        title: platform.name,
        subtitle: platform.uri,
        cover: platform.image,
      };
      pst.caption = platform.description;
      pst.profile = { ...profile, profile_type, platform: platform };

      platform_to_post.push(pst);
    }

    return {
      ok: true,
      data: platform_to_post,
    };
  } else if (list === "profiles") {
    return {
      ok: false,
      data: [],
    };
  }
};

export { get_profile_list_items };
