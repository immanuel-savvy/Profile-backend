import { get_user, login, register, verify } from "./handlers/auth.js";
import {
  get_profile,
  signin,
  signup,
  verify_profile,
} from "./handlers/profile.js";

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
};

export default router;
