import {
  accept_transfer,
  delete_transfer,
  get_platform,
  get_platform_token,
  get_profile_platforms,
  new_platform,
  remove_platform,
  transfer_platform,
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
  get_permissions,
  get_third_parties,
  get_third_parties_by_uri,
  get_third_party,
  get_third_party_registration,
  get_third_party_registrations,
  get_third_party_registrations_by_uri,
  get_token,
  grant_permission,
  register_third_party,
  third_party_profile,
  third_party_signin,
  third_party_signup,
} from "../handlers/v3/third_party.js";
import { me, third_party_me, validate } from "../handlers/v3/validate.js";

// 🔑 Route map (KV store)
const routes = {
  // Third party
  get_third_party_registrations_by_uri: {
    handler: get_third_party_registrations_by_uri,
    security: "api_key",
    schema: {
      body: {
        uris: {
          required: true,
          type: "array",
        },
      },
    },
  },
  get_third_party_registrations: {
    handler: get_third_party_registrations,
    security: "api_key",
    schema: {
      body: {
        limit: {
          type: "number",
          default_value: 20,
        },
        page: {
          type: "number",
          default_value: 0,
        },
      },
    },
  },
  get_third_party_registration: {
    handler: get_third_party_registration,
    security: "api_key",
    schema: {
      body: {
        uri: {
          required: true,
          type: "string",
        },
      },
    },
  },
  get_third_parties: {
    handler: get_third_parties,
    security: "api_key",
    schema: {
      body: {
        limit: {
          type: "number",
          default_value: 20,
        },
        page: {
          default_value: 0,
          type: "number",
        },
      },
    },
  },
  get_third_parties_by_uri: {
    handler: get_third_parties_by_uri,
    security: "api_key",
    schema: {
      body: {
        platforms: {
          type: "array",
          required: true,
        },
      },
    },
  },
  get_third_party: {
    handler: get_third_party,
    security: "api_key",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["token", "owner_uri"],
              type: "string",
              required: true,
            },
          ],
        },
      },
    },
  },
  get_permissions: {
    security: "auth_token",
    handler: get_permissions,
  },
  grant_permission: {
    security: "auth_token",
    handler: grant_permission,
    schema: {
      body: {
        third_party_token: {
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
  third_party_signin: {
    handler: third_party_signin,
    security: "api_key",
    schema: {
      body: {
        profile_type: {
          type: "string",
          required: true,
        },
        third_party_token: {
          type: "string",
          required: true,
        },
        session_token: {
          type: "string",
          required: true,
        },
        allow_signup: {
          type: "boolean",
          required: false,
        },
      },
    },
  },
  third_party_signup: {
    handler: third_party_signup,
    security: "api_key",
    schema: {
      body: {
        profile_type: {
          type: "string",
          required: true,
        },
        third_party_token: {
          type: "string",
          required: true,
        },
        session_token: {
          type: "string",
          required: true,
        },
        allow_signin: {
          type: "boolean",
          required: false,
        },
      },
    },
  },
  register_third_party: {
    handler: register_third_party,
    security: "api_key",
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
    security: "api_key",
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
  third_party_profile: {
    handler: third_party_profile,
    security: "auth_token",
    schema: {
      body: {
        third_party_profile: {
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
  transfer_platform: {
    handler: transfer_platform,
    security: "both",
    schema: {
      body: {
        recipient: {
          type: "string",
          required: true,
        },
      },
    },
  },

  delete_transfer: {
    handler: delete_transfer,
    security: "both",
  },

  accept_transfer: {
    handler: accept_transfer,
    security: "auth_token",
    schema: {
      body: {
        uri: {
          type: "string",
          required: true,
        },
      },
    },
  },
  get_platform_token: {
    handler: get_platform_token,
    security: "auth_token",
    schema: {
      body: {
        uri: { required: true, type: "string" },
      },
    },
  },

  new_platform: {
    handler: new_platform,
    security: "auth_token",
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
  remove_platform: {
    handler: remove_platform,
    security: "auth_token",
    schema: {
      body: {
        uri: {
          required: true,
          type: "string",
        },
      },
    },
  },
  get_platform: {
    handler: get_platform,
    security: "auth_token",
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
    security: "auth_token",
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
    security: "auth_token",
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
    security: "api_key",
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
    security: "api_key",
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
    security: "api_key",
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
  update_profile_type: {
    handler: update_profile_type,
    security: "api_key",
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
    security: "api_key",
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
    security: "api_key",
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
    security: "api_key",
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
    security: "api_key",
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
    security: "api_key",
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
    security: "api_key",
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
    security: "auth_token",
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
    security: "auth_token",
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
    security: "auth_token",
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
