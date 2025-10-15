const {
  GeneralCategory,
  GeneralSubcategory,
  GeneralSubsubCategory,
} = require("../models");

exports.getTree = async (req, res) => {
  try {
    const type = req.query?.type || req.body?.type || "job"; // default: job

    const rows = await GeneralCategory.findAll({
      where: { type },
      include: [
        {
          model: GeneralSubcategory,
          as: "subcategories",
          required: false,
          include: [
            {
              model: GeneralSubsubCategory,
              as: "subsubcategories",
              required: false,
            },
          ],
        },
      ],
      order: [
  // parents (GeneralCategory): by date
  ["createdAt", "ASC"],

  // children: keep alphabetical
  [{ model: GeneralSubcategory, as: "subcategories" }, "name", "ASC"],
  [
    { model: GeneralSubcategory, as: "subcategories" },
    { model: GeneralSubsubCategory, as: "subsubcategories" },
    "name",
    "ASC",
  ],
]

    });

    res.json({ generalCategories: rows, type });
  } catch (err) {
    console.error("Error in getTree (GeneralCategory):", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
