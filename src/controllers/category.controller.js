const { Category, Subcategory, SubsubCategory } = require("../models");

/*exports.getTree = async (req, res) => {
  const rows = await Category.findAll({
    include: [{ model: Subcategory, as: "subcategories", required: false }],
    order: [
      ["name", "ASC"],
      [{ model: Subcategory, as: "subcategories" }, "name", "ASC"],
    ],
  });
  res.json({ categories: rows });
};*/


exports.getTree = async (req, res) => {
  try {
    const type =
      req.query?.type ||
      req.body?.type ||
      (req.user && req.user.accountType) ||
      "individual";

    const rows = await Category.findAll({
      where: { type },
      include: [
        {
          model: Subcategory,
          as: "subcategories",
          required: false,
          where: { type },
          include: [
            {
              model: SubsubCategory,
              as: "subsubs", // ✅ match association
              required: false,
              where: { type },
            },
          ],
        },
      ],
      order: [
        ["name", "ASC"],
        [{ model: Subcategory, as: "subcategories" }, "name", "ASC"],
        [
          { model: Subcategory, as: "subcategories" },
          { model: SubsubCategory, as: "subsubs" }, // ✅ fixed alias here too
          "name",
          "ASC",
        ],
      ],
    });

    res.json({ categories: rows, type });
  } catch (err) {
    console.error("Error in getTree:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


