import crypto from "crypto";

const hash = (password, alg = "sha256") => {
  return crypto.createHash(alg).update(password).digest("hex");
};

export { hash };
