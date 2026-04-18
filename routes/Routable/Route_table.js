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

  // =========================
  // 🧠 SCHEMA VALIDATION CORE
  // =========================
  schema_validation = async (schema, payload) => {
    let body = payload.body || {};
    let errors = [];

    const validate = (schemaNode, dataNode, path = "") => {
      for (let key in schemaNode) {
        if (key === "$logic") continue;

        let rule = schemaNode[key];
        let value = dataNode[key];
        let currentPath = path ? `${path}.${key}` : key;

        // required
        if (rule.required && (value === undefined || value === null)) {
          errors.push(currentPath);
          continue;
        }

        // default
        if (rule.default !== undefined && value === undefined) {
          dataNode[key] = rule.default;
          value = rule.default;
        }

        if (value === undefined) continue;

        // type
        if (rule.type && !this.check_type(rule.type, value, rule)) {
          errors.push(`${currentPath} (invalid type)`);
          continue;
        }

        // enum
        if (rule.type === "enum") {
          let allowed = rule.values.split("|");
          if (!allowed.includes(value)) {
            errors.push(`${currentPath} (invalid enum)`);
          }
        }

        // object struct recursion
        if (rule.type === "object" && rule.struct) {
          validate(rule.struct, value, currentPath);
        }

        // array items
        if (rule.type === "array" && rule.items) {
          for (let i = 0; i < value.length; i++) {
            validate(
              { item: rule.items[0] },
              { item: value[i] },
              `${currentPath}[${i}]`,
            );
          }
        }

        // custom validator
        if (rule.validator && this.validators[rule.validator]) {
          let res = this.validators[rule.validator](value);
          if (!res.ok) errors.push(`${currentPath} (${res.message})`);
        }
      }
    };

    validate(schema.body || {}, body);

    // =========================
    // 🧠 LOGIC EVALUATION
    // =========================
    if (schema.$logic) {
      let ok = this.evaluate_logic(schema.$logic, body);
      if (!ok) {
        errors.push("logical condition failed");
      }
    }

    if (errors.length) {
      return {
        ok: false,
        message: `Missing/Invalid: ${errors.join(", ")}`,
      };
    }

    return { ok: true };
  };

  // =========================
  // 🔀 LOGIC ENGINE
  // =========================
  evaluate_logic = (logic, body) => {
    if (logic.and) {
      return logic.and.every((cond) => this.evaluate_logic(cond, body));
    }

    if (logic.or) {
      return logic.or.some((field) => {
        if (typeof field === "string") {
          return body[field] !== undefined;
        }
        return this.evaluate_logic(field, body);
      });
    }

    return false;
  };

  // =========================
  // 🧩 TYPE SYSTEM
  // =========================
  check_type = (type, value, rule = {}) => {
    if (type === "string") return typeof value === "string";
    if (type === "number") return typeof value === "number";
    if (type === "object")
      return !value && typeof value === "object" && !Array.isArray(value);
    if (type === "array") return Array.isArray(value);
    if (type === "any") return true;

    // 🔗 reference types (future DB binding)
    if (typeof type === "string" && type.startsWith("/")) {
      return true;
    }

    return true;
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
      return {
        ok: false,
        status: 401,
        message: "Unauthorized",
      };
    }

    // 📜 schema
    if (config.schema) {
      let resp = await this.schema_validation(config.schema, payload);
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
