const update_webhook = async (req) => {
  let { headers, body, db } = req;
  let { platform } = headers;
  let { webhook } = body;

  let Platforms = await db.folder("Platforms");

  await Platforms.updateOne(
    { _id: platform._id },
    {
      $set: {
        webhook: {
          url: webhook.url,
          enabled: webhook.enabled ?? true,
          api_version: webhook.api_version ?? "v1",
        },
      },
    },
  );

  return {
    ok: true,
    message: "Webhook updated",
  };
};

const disable_webhook = async (req) => {
  let { headers, db } = req;
  let { platform } = headers;

  let Platforms = await db.folder("Platforms");

  await Platforms.updateOne(
    { _id: platform._id },
    { $set: { "webhook.enabled": false } },
  );

  return {
    ok: true,
    message: "Webhook disabled",
  };
};

const enable_webhook = async (req) => {
  let { headers, db } = req;
  let { platform } = headers;

  let Platforms = await db.folder("Platforms");

  await Platforms.updateOne(
    { _id: platform._id },
    { $set: { "webhook.enabled": true } },
  );

  return {
    ok: true,
    message: "Webhook enabled",
  };
};

const update_platform_webhook = async (req) => {
  let { headers, body, db } = req;
  let { platform } = headers;
  let { token, webhook } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  await Third_party_platforms.updateOne(
    { token, uri: platform.uri },
    {
      $set: {
        webhook: {
          url: webhook.url,
          enabled: webhook.enabled ?? true,
          api_version: webhook.api_version ?? "v1",
          routes: webhook.routes ?? [],
        },
      },
    },
  );

  return {
    ok: true,
    message: "Webhook updated",
  };
};

const disable_platform_webhook = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;
  let { token } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  await Third_party_platforms.updateOne(
    { uri: platform.uri, token },
    { $set: { "webhook.enabled": false } },
  );

  return {
    ok: true,
    message: "Webhook disabled",
  };
};

const enable_platform_webhook = async (req) => {
  let { headers, db, body } = req;
  let { platform } = headers;

  let { token } = body;

  let Third_party_platforms = await db.folder("Third_party_platforms");

  await Third_party_platforms.updateOne(
    { uri: platform.uri, token },
    { $set: { "webhook.enabled": true } },
  );
  return {
    ok: true,
    message: "Webhook enabled",
  };
};

export {
  update_webhook,
  disable_webhook,
  enable_webhook,
  update_platform_webhook,
  enable_platform_webhook,
  disable_platform_webhook,
};
