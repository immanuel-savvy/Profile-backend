import { PROFILES, SESSIONS, TOKENS, USERS } from "../../ds/folders.js";

class Headers {
  constructor() {}

  resolve_api_key = async (req) => {
    let api_key = req.headers["x-api-key"];
    if (!api_key) {
      return { status: 403, message: "API key is missing", ok: false };
    }

    let Tokens = await TOKENS();
    ress = await Tokens.findOne({ token: api_key });

    if (!ress) {
      return { status: 403, message: "Invalid api keys.", ok: false };
    }
    let user = await (
      await USERS()
    ).findOne({
      _id: ress.user,
    });
    if (!user) {
      return {
        status: 403,
        message: "User not found for api key",
        ok: false,
      };
    }

    req.headers.platform = user;

    return true;
  };

  resolve_authorisation_token = async (req) => {
    let authorisation = req.headers["authorization"];
    authorisation = authorisation.replace("Bearer ", "");

    if (!authorisation)
      return { status: 403, message: "Beaere Token is missing", ok: false };

    let Tokens = await SESSIONS();

    ress = await Tokens.findOne({ token: authorisation });

    if (!ress)
      return res.status(403).json({
        error: "Invalid session token",
      });

    let Sessions = await SESSIONS();
    let session = await Sessions.findOne({
      // platform: { $exists: 0 },
      token: authorisation,
    });

    if (!session) {
      return res.status(403).json({
        error: "Invalid session token",
      });
    }

    if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
      await Sessions.deleteOne({ _id: session._id });

      return res.status(403).json({
        error: "Session expired",
      });
    }

    let user = await (
      session?.platform ? await PROFILES() : await USERS()
    ).findOne({
      _id: session.user,
    });

    if (!user) {
      return res.status(403).json({
        error: "User not found for session",
      });
    }

    req.headers.profile = user;

    return true;
  };

  handle_security = async (name, request) => {
    let route = await this.get_route(name),
      result;

    let security = route.config.security;
    if (security.includes("api_key")) {
      result = await this.resolve_api_key(request);
      if (result !== true) return result;
    }
    if (security.includes("bearer_token")) {
      result = await this.resolve_authorisation_token(request);
      if (result !== true) return result;
    }
  };
}

export default Headers;
