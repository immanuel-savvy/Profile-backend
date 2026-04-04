import { PROFILES, SESSIONS, TOKENS, USERS } from "../../ds/folders.js";

const validate = async (req, res) => {
  let platform = req.headers["platform"];
  let profile = req.headers["profile"];

  return res.json({
    ok: true,
    message: "Validation successful",
    data: {
      profile,
      platform,
    },
  });

  // let authorisation = req.headers["authorization"];
  // authorisation = authorisation ? authorisation.replace("Bearer ", "") : null;

  // if (!tok) {
  //   return res.json({
  //     ok: false,
  //   });
  // }

  // let session;
  // if (authorisation) {
  //   session = await (
  //     await SESSIONS()
  //   ).findOne({
  //     platform: platform._id,
  //     token: authorisation,
  //   });

  //   if (!session) {
  //     return res.json({
  //       ok: false,
  //     });
  //   }
  // }

  // let profile =
  //   authorisation && (await (await PROFILES()).findOne({ _id: session.user }));

  // res.json({
  //   ok: true,
  //   data: {
  //     profile,
  //     platform,
  //   },
  // });
};

export { validate };
