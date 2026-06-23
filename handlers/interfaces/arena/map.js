const map = async (req) => {
  let { route } = req,
    response;

  switch (route) {
    case "get_logged_profile_stats":
      response = {
        ok: true,
        data: { stats: [], actions: [] },
      };
      break;
    case "get_logged_profile_lists":
      response = {
        ok: true,
        message: "Lists retrieved",
        data: [
          { _id: "platforms", title: "Platforms", description: "" },
          { _id: "profiles", title: "Profiles", description: "" },
          // {_id: "platforms", title:"Platforms", description:""},
        ],
      };
      break;
  }
  return (
    response || {
      ok: false,
      message: "Not implemented",
      status: 403,
    }
  );
};

export default map;
