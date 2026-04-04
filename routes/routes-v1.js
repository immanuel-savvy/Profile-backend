import { get_user, login, register, verify } from "../handlers/v1/auth.js";
import { user_profiles } from "../handlers/v1/dashboard.js";
import {
  get_profile,
  resend_profile_otp,
  signin,
  signup,
  update_email,
  update_phone,
  update_profile,
  update_profile_password,
  verify_email_or_phone,
  verify_forgot_password,
  verify_profile,
  verify_profile_password,
} from "../handlers/v1/profile.js";
import {
  get_profile_type,
  get_profile_types,
  get_profiles,
  get_settings,
  new_profile_type,
  settings,
  update_profile_type,
} from "../handlers/v1/users.js";

// 🔑 Route map (KV store)
const routes = {
  // Internal
  "/register": register,
  "/verify": verify,
  "/login": login,
  "/get_user": get_user,

  // Service
  "/signin": signin,
  "/signup": signup,
  "/verify_profile": verify_profile,
  "/verify_forgot_password": verify_forgot_password,
  "/resend_profile_otp": resend_profile_otp,
  "/get_profile": get_profile,
  "/update_profile": update_profile,
  "/update_profile_password": update_profile_password,
  "/verify_profile_password": verify_profile_password,
  "/update_email": update_email,
  "/update_phone": update_phone,
  "/verify_email_or_phone": verify_email_or_phone,

  // User
  "/new_profile_type": new_profile_type,
  "/update_profile_type": update_profile_type,
  "/get_profile_type": get_profile_type,
  "/get_profile_types": get_profile_types,
  "/get_profiles": get_profiles,

  // Settings
  "/settings": settings,
  "/get_settings": get_settings,

  // Dashboard
  "/user_profiles": user_profiles,
};

const router = async (req, res) => {
  try {
    const path = req.path; // e.g. "/register"
    const method = req.method.toUpperCase(); // optional if you want method-based routing

    const handler = routes[path];

    if (!handler) {
      return res.status(404).json({
        error: "Route not found",
        path,
      });
    }

    // Call handler
    return await handler(req, res);
  } catch (err) {
    console.error("Router Error:", err);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
};

export default router;
