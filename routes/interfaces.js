import { get_profile_list_items } from "../handlers/interfaces/arena/handlers.js";
import arena_map from "../handlers/interfaces/arena/map.js";

const arena = {
  get_profile_list_items: {
    handler: get_profile_list_items,
    security: "auth_token",
    schema: {
      body: {
        list: { type: "string", required: true },
        page: { type: "number", default_value: 1 },
        limit: { type: "number", default_value: 20 },
      },
    },
  },
  "*": { handler: arena_map, security: "auth_token" },
};

export { arena };
