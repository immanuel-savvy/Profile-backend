import { verify_forgot_password } from "../handlers/v1/profile.js";
import {
  add_platform,
  forgot_password,
  login_platform,
  resend_verification_otp,
  retrieve_api_key,
  verify_platform,
} from "../handlers/v2/platform.js";
import {
  create_profile_type,
  get_profile_type,
  get_profile_types,
  get_profiles,
  get_profiles_by_id,
  update_profile_type,
} from "../handlers/v2/profile_types.js";
import {
  add_profile,
  profile_forgot_password,
  profile_two_factor_auth,
  profile_verify_forgot_password,
  resend_profile_otp,
  signin,
  update_profile,
  update_profile_unique,
  validate_update_profile_unique,
  verify_profile,
} from "../handlers/v2/profiles.js";
import {
  get_token,
  third_party_auth,
  third_party_signin,
} from "../handlers/v2/third_party.js";
import { validate } from "../handlers/v2/validate.js";

// 🔑 Route map (KV store)
const routes = {
  "/validate": validate,

  // Platform
  "/new_platform": add_platform,
  "/verify_platform": verify_platform,
  "/forgot_password": forgot_password,
  "/verify_forgot_password": verify_forgot_password,
  "/login_platform": login_platform,
  "/resend_verification_otp": resend_verification_otp,
  "/retrieve_api_key": retrieve_api_key,

  // Profile types
  "/create_profile_type": create_profile_type,
  "/update_profile_type": update_profile_type,
  "/get_profile_type": get_profile_type,
  "/get_profile_types": get_profile_types,
  "/get_profiles": get_profiles,
  "/get_profiles_by_id": get_profiles_by_id,

  // Profile
  "/signin": signin,
  "/add_profile": add_profile,
  "/verify_profile": verify_profile,
  "/profile_two_factor_auth": profile_two_factor_auth,
  "/profile_forgot_password": profile_forgot_password,
  "/profile_verify_forgot_password": profile_verify_forgot_password,
  "/resend_profile_otp": resend_profile_otp,
  "/resend_profile_otp": update_profile,
  "/update_profile_unique": update_profile_unique,
  "/validate_update_profile_unique": validate_update_profile_unique,

  // Third party
  "/third_party_signin": third_party_signin,
  "/third_party_auth": third_party_auth,
  "/get_token": get_token,
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
