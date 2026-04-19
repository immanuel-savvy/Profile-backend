import {
  add_platform,
  forgot_password,
  login_platform,
  resend_verification_otp,
  retrieve_api_key,
  verify_forgot_password_otp,
  verify_platform,
} from "../handlers/v2/platform.js";
import {
  create_profile_type,
  get_profile_type,
  get_profile_types,
  get_profiles,
  get_profiles_by_id,
  update_profile_type,
} from "../handlers/v2/profile_types.js";
import {
  add_profile,
  profile_forgot_password,
  profile_two_factor_auth,
  profile_verify_forgot_password,
  resend_profile_otp,
  signin,
  update_profile,
  update_profile_unique,
  validate_update_profile_unique,
  verify_profile,
} from "../handlers/v2/profiles.js";
import {
  get_token,
  third_party_auth,
  third_party_signin,
} from "../handlers/v2/third_party.js";
import { validate } from "../handlers/v2/validate.js";
import { normalise_email } from "../handlers/v2/middlewares/middlewares.js";
import Route_table from "./Routable/Route_table.js";
import { type } from "os";

let routable = new Route_table();

let body_norm_email = async (payload) => {
  let res = await normalise_email(payload.body.email);
  if (!res.ok) {
    return res;
  }

  payload.body.email = res.data;
  return { ok: true };
};
// 🔑 Route map (KV store)
const routes = {
  validate: { handler: validate, security: "both" },

  // Platform
  new_platform: {
    handler: add_platform,
    schema: {
      body: {
        email: {
          required: true,
        },
        name: {
          required: true,
        },
        password: {
          required: true,
        },
      },
    },
    middlewares: [body_norm_email],
    security: "first",
  },
  verify_platform: {
    handler: verify_platform,
    security: "both",
    schema: {
      body: {
        email: {
          required: true,
        },
        code: {
          required: true,
        },
      },
    },
    middlewares: [body_norm_email],
    security: "first",
  },
  forgot_password: {
    handler: forgot_password,
    security: "first",
    middlewares: [body_norm_email],
    schema: {
      body: {
        email: { required: true },
      },
    },
  },
  verify_forgot_password: {
    handler: verify_forgot_password_otp,
    security: "first",
    middlewares: [body_norm_email],
    schema: {
      body: {
        email: { required: true },
        code: { required: true },
        new_password: { required: true },
      },
    },
  },
  login_platform: {
    handler: login_platform,
    security: "first",
    middlewares: [body_norm_email],
    schema: {
      body: {
        email: { required: true },
        password: { required: true },
      },
    },
  },
  resend_verification_otp: {
    handler: resend_verification_otp,
    middlewares: [body_norm_email],
    security: "first",
    schema: {
      body: {
        email: { required: true },
      },
    },
  },
  retrieve_api_key: { handler: retrieve_api_key, security: "second" },

  // Profile types
  create_profile_type: {
    handler: create_profile_type,
    security: "first",
    schema: {
      body: {
        name: { required: true, type: "string" },
        description: { required: true, type: "string" },
      },
    },
  },
  update_profile_type: {
    handler: update_profile_type,
    security: "first",
    schema: {
      body: {
        _id: { required: true },
        update: { required: true, type: "object" },
      },
    },
  },
  get_profile_type: {
    handler: get_profile_type,
    security: "first",
    schema: {
      body: {
        $or: {
          properties: ["_id", "name"],
          required: true,
        },
      },
    },
  },
  get_profile_types: { handler: get_profile_types, security: "first" },
  get_profiles: {
    handler: get_profiles,
    security: "first",
    schema: {
      body: {
        page: { default: 1, type: "number" },
        limit: { default: 20, type: "number" },
        profile: { required: 1, type: "/create_profile_type?data._id" },
        search: { type: "string" },
      },
    },
  },
  get_profiles_by_id: {
    handler: get_profiles_by_id,
    security: "first",
    schema: {
      body: {
        _ids: {
          type: "array",
          items: ["/add_profile?data._id"],
          required: true,
        },
      },
    },
  },

  // Profile
  add_profile: {
    handler: add_profile,
    security: "first",
    schema: {
      body: {
        details: {
          type: "object",
          struct: {
            $logic: {
              or: [
                {
                  properties: ["email", "phone"],
                  required: true,
                },
              ],
            },
          },
          required: true,
        },
        profile: {
          required: true,
          type: "/create_profile_type?data._id",
        },
      },
    },
  },
  signin: {
    handler: signin,
    security: "first",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["phone", "email"],
              required: true,
            },
          ],
        },
        profile: {
          required: true,
          type: "/create_profile_type?data._id",
        },
        password: {
          required: true,
          type: "string",
        },
      },
    },
  },
  verify_profile: {
    handler: verify_profile,
    security: "first",
    schema: {
      body: {
        code: { required: true, type: "string" },
        profile: { required: true, type: "/create_profile_type?data._id" },
        $logic: {
          or: [
            {
              properties: ["email", "phone"],
              required: true,
            },
          ],
        },
      },
    },
  },
  profile_two_factor_auth: {
    handler: profile_two_factor_auth,
    security: "first",
    schema: {
      body: {
        code: { required: true, type: "string" },
        profile: { required: true, type: "/create_profile_type?data._id" },
        $logic: {
          or: [
            {
              properties: ["email", "phone"],
              required: true,
            },
          ],
        },
      },
    },
  },
  profile_forgot_password: {
    handler: profile_forgot_password,
    security: "first",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["email", "phone"],
              required: true,
            },
          ],
        },
        profile: {
          required: true,
          type: "/create_profile_type?data._id",
        },
      },
    },
  },
  profile_verify_forgot_password: {
    handler: profile_verify_forgot_password,
    security: "first",
    schema: {
      body: {
        new_password: { required: true, type: "string" },
        profile: { required: true, type: "/create_profile_type?data._id" },
        $logic: {
          or: [
            { properties: ["email", "phone"], required: true },
            { properties: ["code", "token"], required: true },
          ],
        },
      },
    },
  },
  resend_profile_otp: {
    handler: resend_profile_otp,
    security: "first",
    schema: {
      $logic: {
        or: [
          {
            properties: ["email", "phone"],
            required: true,
          },
        ],
      },
      kind: {
        type: "enum",
        values: "psk|ver|upd|2fa",
        default: "vrf",
      },
    },
  },
  update_profile: {
    handler: update_profile,
    security: "both",
    schema: {
      updates: { type: "object", required: true },
    },
  },
  update_profile_unique: {
    handler: update_profile_unique,
    schema: {
      unique: { required: true, type: "string" },
      value: { required: true, type: "any" },
    },
    security: "both",
  },
  validate_update_profile_unique: {
    handler: validate_update_profile_unique,
    security: "second",
    schema: {
      code: { required: true, type: "string" },
    },
  },

  // Third party
  third_party_signin: {
    handler: third_party_signin,
    security: "both",
    schema: {
      details: { required: true, type: "object" },
      platform_profile: { required: true, type: "/add_profile?data._id" },
    },
  },
  third_party_auth: { handler: third_party_auth, security: "all" },
  get_token: {
    handler: get_token,
    security: "first",
    schema: {
      profile: { required: true, type: "/add_profile?data._id" },
      platform_uri: { required: true, type: "/new_platform?data.uri" },
    },
  },
};

await routable.load_routes(routes);

export default routable;
