const pagination = async (folder, limit, skip) => {
  let total = await folder.countDocuments();

  return {
    page: skip / limit + 1,
    pages: Math.ceil(total / limit),
    skip,
    limit,
    total,
  };
};

export default pagination;
