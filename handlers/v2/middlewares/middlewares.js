const email_regex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const normalise_email = async (email) => {
  if (typeof email !== "string")
    return {
      ok: false,
      message: "Invalid email address",
    };

  email = email.toLowerCase().trim();
  if (!email.match(email_regex))
    return {
      ok: false,
      message: "Invalid email address",
    };

  return { ok: true, data: email };
};

export { normalise_email };
