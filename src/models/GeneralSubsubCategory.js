const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const GeneralSubsubCategory = sequelize.define(
    "GeneralSubsubCategory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      generalSubcategoryId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(180), allowNull: false },
    },
    { tableName: "general_subsubcategories", timestamps: true }
  );

  return GeneralSubsubCategory;
};
