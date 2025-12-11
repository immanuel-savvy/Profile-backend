import { get_user, login, register, verify } from "./handlers/auth.js";
import { user_profiles } from "./handlers/dashboard.js";
import {
  get_profile,
  resend_profile_otp,
  signin,
  signup,
  update_profile,
  update_profile_password,
  verify_forgot_password,
  verify_profile,
} from "./handlers/profile.js";
import {
  get_profile_type,
  get_profile_types,
  get_profiles,
  get_settings,
  new_profile_type,
  settings,
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
  app.post("/verify_forgot_password", verify_forgot_password);
  app.post("/resend_profile_otp", resend_profile_otp);
  app.post("/get_profile", get_profile);
  app.post("/update_profile", update_profile);
  app.post("/update_profile_password", update_profile_password);

  // User
  app.post("/new_profile_type", new_profile_type);
  app.post("/update_profile_type", update_profile_type);
  app.post("/get_profile_type", get_profile_type);
  app.post("/get_profile_types", get_profile_types);
  app.post("/get_profiles", get_profiles);
  // Settings
  app.post("/settings", settings);
  app.post("/get_settings", get_settings);

  // Dashboard
  app.post("/user_profiles", user_profiles);
};

export default router;
