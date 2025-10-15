// models/IndustrySubsubCategory.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const IndustrySubsubCategory = sequelize.define(
    "IndustrySubsubCategory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      industrySubcategoryId: {
        type: DataTypes.UUID,
        allowNull: false, // ✅ FK to IndustrySubcategory
      },
    },
    {
      tableName: "industry_subsubcategories",
      timestamps: true,
    }
  );

  return IndustrySubsubCategory;
};
