const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const GeneralSubcategory = sequelize.define(
    "GeneralSubcategory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      generalCategoryId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(180), allowNull: false },
    },
    { tableName: "general_subcategories", timestamps: true }
  );

  return GeneralSubcategory;
};
