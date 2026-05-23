import { Profile_profile_id } from "../../boots.js";
import { Platform_profile_type_id } from "../v2/platform.js";
import { get_platform_profile } from "./profiles.js";

const new_platform = async (req) => {
  let { db, headers, body } = req;
  let { profile } = headers;
  let { name, uri, description } = body;

  let platform = {
    name,
    uri,
    description,
    _id: crypto.randomUUID(),
    created: Date.now(),
    profile: profile._id,
  };
  let Platforms = await db.folder("Platforms");

  if (await Platforms.findOne({ uri })) {
    return {
      ok: false,
      status: 400,
      message: "Platform uri have been used",
    };
  }

  await Platforms.insertOne(platform);

  let token = crypto.randomBytes(48).toString("hex");

  await (
    await db.folder("Platform_tokens")
  ).insertOne({
    _id: crypto.randomUUID(),
    platform: platform._id,
    token,
    created: Date.now(),
  });

  return {
    ok: true,
    message: "Platform created",
    token,
    data: platform,
  };
};

const get_platform = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;

  let { uri, platform_id } = body;

  let query = { profile: profile._id };

  if (uri) query.uri = uri;
  else if (platform_id) query._id = platform_id;

  let Platforms = await db.folder("Platforms");
  let platform = await Platforms.findOne(query);

  if (!platform) {
    return {
      ok: false,
      status: 400,
      message: "Platform not found.",
    };
  }

  return {
    ok: true,
    message: "Platform retrieved",
    data: platform,
  };
};

const update_platform = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  let { uri, updates } = body;

  if (!updates || typeof updates !== "object") {
    return {
      ok: false,
      status: 400,
      message: "Invalid updates object",
    };
  }

  // remove disallowed fields if present
  ["uri", "created", "updated"].forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      delete updates[key];
    }
  });

  let Platforms = await db.folder("Platforms");
  let res = await Platforms.updateOne({ uri }, { $set: updates });

  if (
    !res ||
    (typeof res.matchedCount === "number" && res.matchedCount === 0)
  ) {
    return {
      ok: false,
      status: 400,
      message: "Platform not found.",
    };
  }

  // fetch current doc to return to caller
  let platform = await Platforms.findOne({ uri, profile: profile._id });

  // If driver doesn't provide modifiedCount, treat as success with returned doc
  const modified =
    typeof res.modifiedCount === "number" ? res.modifiedCount : null;

  if (modified === 0) {
    return {
      ok: true,
      message: "No changes made.",
      data: platform,
    };
  }

  return {
    ok: true,
    message: "Platform updated.",
    data: platform,
  };
};

const get_profile_platforms = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  let { page = 1, limit = 20 } = body || {};

  if (page < 1 || limit < 1) {
    return {
      ok: false,
      status: 400,
      message: "Invalid pagination parameters",
    };
  }

  // enforce an upper bound for safety
  limit = Math.min(limit, 100);

  let query = { profile: profile._id };

  let Platforms = await db.folder("Platforms");

  // attempt to get total count when supported
  let total = null;
  if (typeof Platforms.countDocuments === "function") {
    total = await Platforms.countDocuments(query);
  } else if (typeof Platforms.count === "function") {
    total = await Platforms.count(query);
  }

  let skip = (page - 1) * limit;
  let cursor = Platforms.find ? Platforms.find(query) : [];
  // sort by newest first when possible
  if (cursor && typeof cursor.sort === "function")
    cursor = cursor.sort({ created: -1 });
  if (cursor && typeof cursor.skip === "function") cursor = cursor.skip(skip);
  if (cursor && typeof cursor.limit === "function")
    cursor = cursor.limit(limit);

  let items;
  if (cursor && typeof cursor.toArray === "function") {
    items = await cursor.toArray();
  } else if (Array.isArray(cursor)) {
    items = cursor.slice(skip, skip + limit);
  } else {
    // fallback: try await directly (some drivers return a promise for array)
    items = await cursor;
  }

  return {
    ok: true,
    message: "Platforms retrieved",
    pagination: {
      total,
      limit,
      skip,
      page,
    },
    data: items,
  };
};

const add_permissions = async (req) => {
  let { headers, body } = req;
  let { platform } = headers;
  let { permissions } = body;

  let res = await req.services("settings").call(
    "add_setting",
    {
      category: platform._id,
      key: "permissions",
      value: permissions,
    },
    { profile: await get_platform_profile(req, platform) },
  );

  return res;
};

const transfer_platform = async (req) => {
  let { headers, db, body } = req;

  let { profile, platform } = headers;
  let { recipient } = body;

  if (platform.profile !== profile._id) {
    return {
      ok: false,
      status: 403,
      message: "Unauthorised",
      response_code: "unauthorised",
    };
  }

  let recipient_profile = await (
    await db.folder("Profiles")
  ).findOne({ _id: recipient });

  if (
    !recipient_profile ||
    recipient_profile?.profile !== Platform_profile_type_id
  ) {
    return {
      ok: false,
      message: "Invalid recipient",
      response_code: "invalid_recipient",
    };
  }

  let Pending_platform_transfers = await db.folder(
    "Pending_platform_transfers",
  );

  let tf = await Pending_platform_transfers.findOne({ platform: platform._id });

  if (tf) {
    return {
      ok: false,
      message: "Pending transfer",
      response_code: "pending_transfer",
      status: 401,
    };
  }

  await Pending_platform_transfers.insertOne({
    platform: platform._id,
    profile: profile._id,
    created: Date.now(),
    recipient,
    _id: crypto.randomUUID(),
  });

  await req.services("aimail").call(
    "send_mail",
    {
      to: recipient.email,
      content: {
        template: "platform_transfer",
        params: { platform, to: recipient, from: profile },
      },
    },
    {
      profile: await (
        await db.folder("Profiles")
      ).findOne({ _id: Profile_profile_id }),
    },
  );

  return {
    ok: true,
    message: "Tranfer sent",
    response_code: "transfer_sent",
  };
};

const delete_transfer = async (req) => {
  let { headers, db } = req;

  let { profile, platform } = headers;

  let Pendings = await db.folder("Pending_platform_transfers");

  // perform delete and confirm using delete count variations across drivers
  const res = await Pendings.deleteOne({
    platform: platform._id,
    profile: profile._id,
  });

  // normalize deleted count from common driver responses
  const deletedCount =
    typeof res.deletedCount === "number"
      ? res.deletedCount
      : res.result && typeof res.result.n === "number"
        ? res.result.n
        : typeof res.n === "number"
          ? res.n
          : 0;

  if (deletedCount > 0) {
    return {
      ok: true,
      message: "Pending transfer deleted",
      response_code: "transfer_deleted",
    };
  }

  return {
    ok: false,
    status: 400,
    message: "Failed to delete pending transfer",
    response_code: "delete_failed",
  };
};

const accept_transfer = async (req) => {
  let { headers, db, body } = req;
  let { profile } = headers;
  let { uri } = body;

  let Platforms = await db.folder("Platforms");
  let platform = await Platforms.findOne({ uri });

  if (!platform)
    return {
      ok: false,
      message: "Invalid uri",
      response_code: "invalid_uri",
      status: 400,
    };

  let Pendings = await db.folder("Pending_platform_transfers");
  let pending = await Pendings.findOne({
    platform: platform._id,
    recipient: profile._id,
  });

  if (!pending) {
    return {
      ok: false,
      message: "Transfer not found",
      response_code: "transfer_not_found",
    };
  }

  await Platforms.updateOne({ _id: platform._id }, { profile: profile._id });
  await Pendings.deleteOne({ _id: pending._id });

  let from = await (
    await db.folder("Profiles")
  ).findOne({ _id: platform.profile });

  let aimail = req.services("aimail");
  await aimail.call("send_mail", {
    to: profile.email,
    content: {
      template: "platform_transfer_accepted",
      params: {
        platform,
        profile,
        from,
      },
    },
  });

  await aimail.call("send_mail", {
    to: from.email,
    content: {
      template: "transfer_accepted",
      params: {
        platform,
        to: profile,
        profile: from,
      },
    },
  });

  return {
    ok: true,
    message: "Transfer done",
    response_code: "transfer_done",
  };
};

export {
  new_platform,
  get_platform,
  update_platform,
  get_profile_platforms,
  add_permissions,
  transfer_platform,
  accept_transfer,
  delete_transfer,
};
