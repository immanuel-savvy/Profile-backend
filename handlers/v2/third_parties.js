const register_third_party = async (req) => {
  let { platform } = req.headers;
  let { body, db } = req;

  let Third_parties = await db.folder("Third_parties");

  let existing = await Third_parties.findOne({
    platform: platform._id,
    uri: body.uri,
  });

  if (existing) {
    return {
      ok: false,
      message: "Third party already registered",
    };
  }

  let result = await Third_parties.insert({
    platform: platform._id,
    uri: body.uri,
    name: body.name,
    description: body.description,
    permissions: body.permissions || [],
    _id: crypto.randomUUID(),
  });

  if (result) {
    return {
      ok: true,
      message: "Third party registered successfully",
      data: result,
    };
  } else {
    return {
      ok: false,
      message: "Failed to register third party",
    };
  }
};

const remove_third_party = async (req) => {
  let { platform } = req.headers;
  let { db, body } = req;

  let Third_parties = await db.folder("Third_parties");

  let existing = await Third_parties.findOne({
    platform: platform._id,
    uri: body.uri,
  });

  if (!existing) {
    return {
      ok: false,
      message: "Third party not found",
    };
  }

  let result = await Third_parties.delete(existing._id);

  if (result) {
    return {
      ok: true,
      message: "Third party removed successfully",
    };
  } else {
    return {
      ok: false,
      message: "Failed to remove third party",
    };
  }
};

const get_third_parties = async (req) => {
  let { platform } = req.headers;
  let { db } = req;

  let Third_parties = await db.folder("Third_parties");

  let parties = await Third_parties.find({ platform: platform._id });

  return {
    ok: true,
    message: "",
    data: parties,
  };
};

export { register_third_party, get_third_parties, remove_third_party };
