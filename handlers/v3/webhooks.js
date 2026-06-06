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
          events: webhook.events ?? ["*"],
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

export { update_webhook, disable_webhook, enable_webhook };
