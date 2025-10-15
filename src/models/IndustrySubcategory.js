// models/IndustrySubcategory.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const IndustrySubcategory = sequelize.define(
    "IndustrySubcategory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      industryCategoryId: {
        type: DataTypes.UUID,
        allowNull: false,   // FK to IndustryCategory
      },
    },
    {
      tableName: "industry_subcategories",
      timestamps: true,
    }
  );
  return IndustrySubcategory;
};
