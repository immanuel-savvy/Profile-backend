const DEBUG = process.env.DEBUG === "true";

const debug = (...args) => {
  if (!DEBUG) return;

  const timestamp = new Date().toISOString();

  debug(`[DEBUG ${timestamp}]`, ...args);
};

export default debug;
