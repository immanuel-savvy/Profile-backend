import { login, register, verify } from "./handlers/auth";

const router = (app) => {
  // Internal Routes - no api tokens at this implementation
  app.post("/register", register);
  app.post("/verify", verify);
  app.post("/login", login);

  // Service routes
};

export default router;
