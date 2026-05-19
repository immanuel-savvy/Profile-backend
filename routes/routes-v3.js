import {
  get_platform,
  get_profile_platforms,
  new_platform,
  update_platform,
} from "../handlers/v3/platforms.js";
import {
  create_profile_type,
  get_profile_type,
  get_profile_types,
  update_profile_type,
} from "../handlers/v3/profile_types.js";
import {
  confirm_update_profile_identity,
  forgot_password,
  reset_password,
  signin,
  signup,
  two_factor_signin,
  two_factor_signup,
  update_profile,
  update_profile_identity,
} from "../handlers/v3/profiles.js";
import {
  authorise_third_party,
  get_token,
  register_third_party,
} from "../handlers/v3/third_party.js";
import { me, third_party_me, validate } from "../handlers/v3/validate.js";

// 🔑 Route map (KV store)
const routes = {
  // Third party
  register_third_party: {
    handler: register_third_party,
    security: "first",
    schema: {
      body: {
        uri: {
          type: "string",
          required: true,
        },
        permissions: {
          type: "object",
          required: false,
        },
        profile_types: {
          type: "array",
          required: true,
        },
      },
    },
  },
  authorise_third_party: {
    handler: authorise_third_party,
    security: "both",
    schema: {
      body: {
        third_party_token: {
          required: true,
          type: "string",
        },
        platform_uri: {
          type: "string",
          required: true,
        },
        session_token: {
          type: "string",
          required: true,
        },
      },
    },
  },
  get_token: {
    handler: get_token,
    security: "first",
    schema: {
      body: {
        profile: {
          type: "string",
          required: true,
        },
        platform_uri: {
          type: "string",
          required: true,
        },
      },
    },
  },

  // Validate
  validate: {
    handler: validate,
    security: "none",
  },
  me: {
    handler: me,
    security: "none",
  },
  third_party_me: {
    handler: third_party_me,
    security: "none",
    schema: {
      body: {
        from: {
          type: "string",
          required: true,
        },
      },
    },
  },

  // Platforms
  new_platform: {
    handler: new_platform,
    security: "second",
    schema: {
      body: {
        name: {
          required: true,
          type: "string",
        },
        uri: {
          required: true,
          type: "string",
        },
        description: {
          required: false,
          default_value: "",
          type: "string",
        },
      },
    },
  },
  get_platform: {
    handler: get_platform,
    security: "second",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["uri", "platform_id"],
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  },
  update_platform: {
    handler: update_platform,
    security: "second",
    schema: {
      body: {
        uri: {
          type: "string",
          required: true,
        },
        updates: {
          type: "object",
          required: true,
        },
      },
    },
  },
  get_profile_platforms: {
    handler: get_profile_platforms,
    security: "second",
    schema: {
      body: {
        page: {
          required: false,
          default_value: 1,
          type: "number",
        },
        limit: {
          required: false,
          default_value: 20,
          type: "number",
        },
      },
    },
  },

  // Profile Types
  create_profile_type: {
    handler: create_profile_type,
    security: "first",
    schema: {
      body: {
        name: {
          required: true,
          type: "string",
        },
        type: {
          required: true,
          type: "string",
        },
        description: {
          required: false,
          default_value: "",
          type: "string",
        },
      },
    },
  },
  get_profile_type: {
    handler: get_profile_type,
    security: "first",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["type", "profile_type_id"],
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  },
  get_profile_types: {
    handler: get_profile_types,
    security: "first",
  },
  update_profile_type: {
    handler: update_profile_type,
    security: "first",
    schema: {
      body: {
        profile_type_id: {
          required: true,
          type: "string",
        },
        updates: {
          required: true,
          type: "object",
        },
      },
    },
  },

  // Profiles
  signin: {
    handler: signin,
    security: "first",
    schema: {
      body: {
        credentials: {
          required: true,
          type: "object",
        },
        profile_type: {
          required: true,
        },
        meta_payload: {
          required: false,
          type: "object",
        },
      },
    },
  },
  two_factor_signin: {
    handler: two_factor_signin,
    security: "first",
    schema: {
      body: {
        continuation_token: {
          required: true,
        },
        $logic: {
          or: [
            {
              properties: ["otp", "token"],
              required: true,
              type: "string",
            },
          ],
        },
        profile_type: {
          required: true,
        },
      },
    },
  },
  signup: {
    handler: signup,
    security: "first",
    schema: {
      body: {
        details: {
          required: true,
          type: "object",
        },
        profile_type: {
          required: true,
        },
        password: {
          required: true,
          type: "string",
        },
      },
    },
  },
  two_factor_signup: {
    handler: two_factor_signup,
    security: "first",
    schema: {
      body: {
        continuation_token: {
          required: true,
        },
        $logic: {
          or: [
            {
              properties: ["otp", "token"],
              required: true,
              type: "string",
            },
          ],
        },
        profile_type: {
          required: true,
        },
      },
    },
  },
  forgot_password: {
    handler: forgot_password,
    security: "first",
    schema: {
      body: {
        identity: {
          type: "object",
          required: true,
        },
        profile_type: {
          required: true,
        },
      },
    },
  },
  reset_password: {
    handler: reset_password,
    security: "first",
    schema: {
      body: {
        continuation_token: {
          required: true,
        },
        $logic: {
          or: [
            {
              properties: ["otp", "token"],
              required: true,
              type: "string",
            },
          ],
        },
        profile_type: {
          required: true,
        },
        new_password: {
          type: "string",
          required: true,
        },
      },
    },
  },

  update_profile: {
    handler: update_profile,
    security: "second",
    schema: {
      body: {
        updates: {
          type: "object",
          required: true,
        },
      },
    },
  },
  update_profile_identity: {
    handler: update_profile_identity,
    security: "second",
    schema: {
      body: {
        identity: {
          type: "object",
          required: true,
        },
      },
    },
  },

  confirm_update_profile_identity: {
    handler: confirm_update_profile_identity,
    security: "second",
    schema: {
      body: {
        continuation_token: {
          required: true,
        },
        $logic: {
          or: [
            {
              properties: ["otp", "token"],
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  },
};

export default routes;
