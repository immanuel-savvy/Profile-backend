import { USERS } from "../ds/folders";

const get_user = async (_id) => {
  let Users = await USERS();

  return await Users.findOne({ _id });
};

export { get_user };
