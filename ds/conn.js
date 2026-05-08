import { Mongo } from "@godprotocol/repositories";

let db_instance = null;
const conn = () => {
  if (db_instance) return db_instance;

  let db = new Mongo({
    db_url: process.env.MONGODB_URI,
    db_name: process.env.PLATFORM_URI.replace(/\./g, "-"),
  });

  db_instance = db;
  return db;
};

const DB = conn;

export default conn;
export { DB };
