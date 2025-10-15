const {
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
} = require("../models");

async function getIndustryCategoriesTree(req, res, next) {
  try {
    const industryCategories = await IndustryCategory.findAll({
      include: [
        {
          model: IndustrySubcategory,
          as: "subcategories",
          include: [
            {
              model: IndustrySubsubCategory,
              as: "subsubs",
            },
          ],
        },
      ],
      order: [
        // top-level industry categories → respect seed order via createdAt
        ["createdAt", "ASC"],

        // children alphabetical
        [{ model: IndustrySubcategory, as: "subcategories" }, "name", "ASC"],
        [
          { model: IndustrySubcategory, as: "subcategories" },
          { model: IndustrySubsubCategory, as: "subsubs" },
          "name",
          "ASC",
        ],
      ]
    });

    res.json({
      industryCategories: industryCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        subcategories: cat.subcategories?.map((sub) => ({
          id: sub.id,
          name: sub.name,
          subsubs: sub.subsubs?.map((subsub) => ({
            id: subsub.id,
            name: subsub.name,
          })) || [],
        })) || [],
      })),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getIndustryCategoriesTree,
};