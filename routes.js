import { get_user, login, register, verify } from "./handlers/auth.js";
import { user_profiles } from "./handlers/dashboard.js";
import {
  get_profile,
  signin,
  signup,
  verify_profile,
} from "./handlers/profile.js";
import {
  get_profile_type,
  get_profile_types,
  get_profiles,
  new_profile_type,
  update_profile_type,
} from "./handlers/users.js";

const router = (app) => {
  // Internal Routes - no api tokens at this implementation
  app.post("/register", register);
  app.post("/verify", verify);
  app.post("/login", login);
  app.post("/get_user", get_user);

  // Service routes
  app.post("/signin", signin);
  app.post("/signup", signup);
  app.post("/verify_profile", verify_profile);
  app.post("/get_profile", get_profile);

  // User
  app.post("/new_profile_type", new_profile_type);
  app.post("/update_profile_type", update_profile_type);
  app.post("/get_profile_type", get_profile_type);
  app.post("/get_profile_types", get_profile_types);
  app.post("/get_profiles", get_profiles);

  // Dashboard
  app.post("/user_profiles", user_profiles);
};

export default router;
