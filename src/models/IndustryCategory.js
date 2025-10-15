// models/IndustryCategory.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const IndustryCategory = sequelize.define(
    "IndustryCategory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
    },
    {
      tableName: "industry_categories",
      timestamps: true,
    }
  );

  return IndustryCategory;
};
