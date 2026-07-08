import {
  create_profile_key,
  generate_ott,
  refresh_ott,
  refresh_platform_key,
  refresh_profile_key,
  retrieve_platform_key,
  retrieve_platform_keys,
  retrieve_profile_key,
  retrieve_profile_keys,
  revoke_ott,
  revoke_platform_key,
  revoke_profile_key,
} from "../handlers/v3/api_keys.js";
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
  add_profile,
  create_profile_type,
  edit_profile,
  get_profile,
  get_profile_type,
  get_profile_types,
  get_profiles,
  update_profile_type,
} from "../handlers/v3/profile_types.js";
import {
  confirm_update_profile_identity,
  forgot_password,
  resend_2fa,
  reset_password,
  reset_password_by_old_password,
  signin,
  signout,
  signup,
  two_factor_signin,
  two_factor_signup,
  update_profile,
  update_profile_identity,
  update_social_identity,
  validate_continuation_token,
} from "../handlers/v3/profiles.js";
import { third_party_signup } from "../handlers/v3/signup_with.js";
import {
  authorise_third_party,
  get_permissions,
  get_profile_authorised_third_parties,
  get_profile_unauthorised_third_parties,
  get_registered_third_parties,
  get_registered_third_party,
  get_registration_by_owner_uri,
  get_registrations,
  get_token,
  grant_permission,
  register_third_party,
  third_party_profile,
  update_third_party_permissions,
} from "../handlers/v3/third_party.js";
import { me, third_party_me, validate } from "../handlers/v3/validate.js";
import {
  disable_platform_webhook,
  disable_webhook,
  enable_platform_webhook,
  enable_webhook,
  update_platform_webhook,
  update_webhook,
} from "../handlers/v3/webhooks.js";

// 🔑 Route map (KV store)
const routes = {
  // Third party
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
  update_third_party_permissions: {
    handler: update_third_party_permissions,
    security: "api_key",
    schema: {
      body: {
        token: {
          type: "string",
          required: true,
        },
        permissions: {
          type: "object",
          required: true,
        },
      },
    },
  },
  authorise_third_party: {
    handler: authorise_third_party,
    security: "auth_token",
    schema: {
      body: {
        third_party_token: {
          required: true,
          type: "string",
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
  get_registered_third_parties: {
    handler: get_registered_third_parties,
    security: "api_key",
    schema: {
      body: {
        limit: { type: "number", default_value: 20 },
        page: { type: "number", default_value: 1 },
      },
    },
  },
  get_registered_third_party: {
    handler: get_registered_third_party,
    security: "api_key",
    schema: {
      body: {
        uri: { type: "string", required: true },
      },
    },
  },
  get_registrations: {
    handler: get_registrations,
    security: "api_key",
    schema: {
      body: {
        limit: { type: "number", default_value: 20 },
        page: { type: "number", default_value: 1 },
      },
    },
  },
  get_registration_by_owner_uri: {
    handler: get_registration_by_owner_uri,
    security: "api_key",
    schema: {
      body: {
        owner_uri: { type: "string", required: true },
      },
    },
  },

  get_profile_authorised_third_parties: {
    handler: get_profile_authorised_third_parties,
    security: "auth_token",
    schema: {
      body: {
        limit: { type: "number", default_value: 20 },
        page: { type: "number", default_value: 1 },
      },
    },
  },
  get_profile_unauthorised_third_parties: {
    handler: get_profile_unauthorised_third_parties,
    security: "auth_token",
    schema: {
      body: {
        limit: { type: "number", default_value: 20 },
        page: { type: "number", default_value: 1 },
      },
    },
  },
  third_party_signup: {
    handler: third_party_signup,
    security: "auth_token",
    schema: {
      body: {
        third_party_token: { type: "string", required: true },
        profile_type: { type: "string", required: true },
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
    security: "auth_token",
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
    security: "auth_token",
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
  get_profiles: {
    handler: get_profiles,
    security: "api_key",
    schema: {
      body: {
        profile_type: {
          required: true,
          type: "string",
        },
        limit: {
          type: "number",
          default_value: 20,
        },
        page: {
          type: "number",
          default_value: 1,
        },
      },
    },
  },
  get_profile: {
    handler: get_profile,
    security: "api_key",
    schema: {
      body: {
        _id: {
          type: "string",
          required: true,
        },
      },
    },
  },
  add_profile: {
    handler: add_profile,
    security: "api_key",
    schema: {
      body: {
        details: { type: "object", required: true },
        profile_type: { type: "string", required: true },
        password: { type: "string", required: true },
      },
    },
  },
  edit_profile: {
    handler: edit_profile,
    security: "api_key",
    schema: {
      body: {
        update: { type: "object", required: true },
        profile_type: { type: "string", required: true },
        profile_id: { type: "string", required: true },
      },
    },
  },

  // Profiles
  signin: {
    handler: signin,
    security: "api_key",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["credentials", "social"],
              required: true,
              type: "object",
            },
          ],
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
        $logic: {
          or: [
            {
              properties: ["details", "social"],
              required: true,
              type: "object",
            },
          ],
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
  resend_2fa: {
    handler: resend_2fa,
    security: "api_key",
    schema: {
      body: {
        continuation_token: { required: true, type: "string" },
        sub_per: { required: true, type: "string" },
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
  validate_continuation_token: {
    handler: validate_continuation_token,
    security: "api_key",
    schema: {
      body: {
        continuation_token: {
          type: "string",
          required: true,
        },
        profile_type: {
          required: true,
          type: "string",
        },
        sub_per: {
          type: "string",
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
          type: "string",
        },
      },
    },
  },
  reset_password: {
    handler: reset_password,
    security: "api_key",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["continuation_token", "validation_token"],
              required: true,
              type: "string",
            },
            {
              properties: ["otp", "token", "validation_token"],
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
        // patch
        $logic: {
          or: [
            {
              properties: ["updates", "data"],
              required: true,
              type: "object",
            },
          ],
        },
        // updates: {
        //   type: "object",
        //   required: true,
        // },
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

  update_social_identity: {
    handler: update_social_identity,
    security: "auth_token",
    schema: {
      body: {
        social: { type: "object", required: true },
      },
    },
  },

  // Webhooks
  update_webhook: {
    handler: update_webhook,
    security: "api_key",
    schema: {
      body: {
        webhook: { type: "object", required: true },
      },
    },
  },
  enable_webhook: {
    handler: enable_webhook,
    security: "api_key",
  },
  disable_webhook: {
    handler: disable_webhook,
    security: "api_key",
  },
  disable_platform_webhook: {
    handler: disable_platform_webhook,
    security: "api_key",
    schema: {
      body: { token: { required: true, type: "string" } },
    },
  },
  enable_platform_webhook: {
    handler: enable_platform_webhook,
    security: "api_key",
    schema: {
      body: { token: { required: true, type: "string" } },
    },
  },
  update_platform_webhook: {
    handler: update_platform_webhook,
    security: "api_key",
    schema: {
      body: {
        webhook: { type: "object", required: true },
        token: { type: "string", required: true },
      },
    },
  },
  signout: {
    handler: signout,
    security: "auth_token",
  },
  reset_password_by_old_password: {
    handler: reset_password_by_old_password,
    security: "auth_token",
    schema: {
      body: {
        old_password: { required: true, type: "string" },
        new_password: { required: true, type: "string" },
      },
    },
  },

  // API Keys
  refresh_platform_key: {
    handler: refresh_platform_key,
    security: "api_key",
    schema: {
      body: {
        name: { type: "string", default_value: "" },
      },
    },
  },
  refresh_profile_key: {
    handler: refresh_profile_key,
    security: "auth_token",
    schema: {
      body: {
        name: { type: "string", default_value: "" },
      },
    },
  },
  create_profile_key: {
    handler: create_profile_key,
    security: "auth_token",
    schema: {
      body: {
        name: { type: "string", default_value: "" },
      },
    },
  },
  retrieve_platform_key: {
    handler: retrieve_platform_key,
    security: "api_key",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["name", "token"],
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  },
  retrieve_profile_key: {
    handler: retrieve_profile_key,
    security: "auth_token",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["name", "token"],
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  },
  retrieve_platform_keys: {
    handler: retrieve_platform_keys,
    security: "api_key",
    schema: {
      body: {
        limit: { type: "number", default_value: 20 },
        page: { type: "number", default_value: 1 },
      },
    },
  },
  retrieve_profile_keys: {
    handler: retrieve_profile_keys,
    security: "auth_token",
    schema: {
      body: {
        limit: { type: "number", default_value: 20 },
        page: { type: "number", default_value: 1 },
      },
    },
  },
  revoke_platform_key: {
    handler: revoke_platform_key,
    security: "api_key",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["name", "token"],
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  },
  revoke_profile_key: {
    handler: revoke_profile_key,
    security: "auth_token",
    schema: {
      body: {
        $logic: {
          or: [
            {
              properties: ["name", "token"],
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  },

  revoke_ott: {
    handler: revoke_ott,
    security: "auth_token",
    schema: {
      body: {
        token: { required: true, type: "string" },
      },
    },
  },
  generate_ott: {
    handler: generate_ott,
    security: "auth_token",
    schema: {
      body: {
        name: { type: "string", default_value: "" },
        limit: { type: "number", default_value: 1 },
        duration: { type: "number", default_value: -1 },
        endpoints: { type: "array", default_value: [] },
      },
    },
  },
  refresh_ott: {
    handler: refresh_ott,
    security: "auth_token",
    schema: {
      body: {
        token: { type: "string", required: true },
        limit: { type: "number", default_value: 1 },
        duration: { type: "number", default_value: -1 },
        endpoints: { type: "array", default_value: [] },
      },
    },
  },
};

export default routes;
