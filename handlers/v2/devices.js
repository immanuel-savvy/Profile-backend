const get_device_profiles = async (req) => {
  let { platform } = req.headers;
  let { db, body } = req;

  let Sessions = await db.folder("Sessions");

  let devices = await Sessions.find({
    platform: platform._id,
    deviceid: body.deviceid,
    profile: body.profile_type,
  });

  let profiles = [];

  for (let device of devices) {
    let profile = await (
      await db.folder("profiles")
    ).findOne({ _id: device.user });
    if (profile) profiles.push(profile);
  }

  return {
    ok: true,
    message: "",
    data: profiles,
  };
};

export { get_device_profiles };
