import Headers from "./Header.js";

let securities = {
  both: ["api_key", "bearer_token"],
  first: ["api_key"],
  second: ["bearer_token"],
  all: ["api_key", "bearer_token", "xplatform"],
  none: [],
};

class Route_table extends Headers {
  constructor() {
    super();
    this.routes = {};
    this.validators = {};
  }

  // 🔌 extensibility
  register_validator = (name, fn) => {
    this.validators[name] = fn;
  };

  load_routes = async (routes) => {
    for (let name in routes) {
      let { handler, ...config } = routes[name];

      config.security = securities[config.security || "none"];

      await this.add_route(name, handler, config);
    }
  };

  add_route = async (name, handler, config) => {
    this.routes[name] = { handler, config };
  };

  get_route = async (name) => this.routes[name];

  check_validation = async (rule, data) => {
    let { prop, type, required, default: is_default } = rule;

    let data_value = data[prop];

    data_value =
      data_value == null || data_value == undefined ? is_default : data_value;

    if (required && (data_value == null || data_value == is_default))
      return { ok: false, message: `Field '${prop}' is required` };

    if (data_value == null) {
      return { ok: true };
    }

    if (type) {
      if (type.startsWith("/")) {
      } else {
        let type_of = typeof data_value;
        if (type_of !== type)
          return {
            ok: false,
            message: `Field '${prop}' must be of type '${type}' got '${type_of}'`,
          };
      }
    }

    return { ok: true };
  };

  validate = async (schema, data) => {
    let { body: schema_body } = schema;
    let { body: data_body } = data;

    for (let prop in schema_body) {
      let rule = schema_body[prop];

      if (prop === "$logic") {
        let or_logic = rule.or;
        if (or_logic) {
          for (let o = 0; o < or_logic.length; o++) {
            let or_rule = or_logic[o],
              or_rule_check;

            for (let proper of or_rule.properties) {
              or_rule_check = await this.check_validation(
                { prop: proper, ...or_rule },
                data_body,
              );

              if (or_rule_check?.ok) break;
            }
            if (or_rule.required && !or_rule_check?.ok) {
              return {
                ok: false,
                message: `At least one of the following fields is required: ${or_rule.properties.join(
                  ", ",
                )}`,
              };
            }
          }
        }

        let and_logic = rule.and;
        if (and_logic) {
          for (let a = 0; a < and_logic.length; a++) {
            let and_rule = and_logic[a];

            for (let prop of and_rule.properties) {
              let and_rule_check = await this.check_validation(
                { prop, ...and_rule },
                data_body,
              );

              if (and_rule.required && !and_rule_check?.ok) {
                return {
                  ok: false,
                  message: `Field '${prop}' is required`,
                };
              }
            }
          }
        }
      }

      let validation_result = await this.check_validation(
        { prop, ...rule },
        data_body,
      );

      if (!validation_result.ok) {
        return validation_result;
      }
    }

    return { ok: true };
  };

  // =========================
  // 🚀 EXECUTION PIPELINE
  // =========================
  execute = async (name, payload) => {
    let route = await this.get_route(name);

    if (!route) {
      return {
        ok: false,
        status: 404,
        message: "Route not found",
        data: { path: `/${name}`, name },
      };
    }

    let { handler, config } = route;

    // 🔐 security
    if (!this.check_security(config.security, payload)) {
      console.log(
        "Unauthorized access attempt to route:",
        name,
        "with payload:",
        payload,
      );
      return {
        ok: false,
        status: 401,
        message: "Unauthorized",
      };
    }

    // 📜 schema
    if (config.schema) {
      let resp = await this.validate(config.schema, payload);

      console.log("Validation result for route", name, ":", resp);

      if (!resp.ok) return resp;
    }

    // ⚙️ middleware
    for (let middleware of config.middlewares || []) {
      let result = await middleware(payload);
      if (!result?.ok) return result;
    }

    // 🎯 handler
    return await handler(payload);
  };

  // =========================
  // 🔐 SECURITY ENGINE
  // =========================
  check_security = (requirements, payload) => {
    if (!requirements?.length) return true;

    let headers = payload.headers || {};

    let checks = {
      api_key: () => !!headers["x-api-key"],
      bearer_token: () => !!headers["authorization"],
      xplatform: () => !!headers["x-platform"],
    };

    return requirements.every((r) => checks[r]?.());
  };
}

export default Route_table;
