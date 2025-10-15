// subcategory.js
const { v4: uuidv4 } = require("uuid");
module.exports = (sequelize, DataTypes) => {
  const Subcategory = sequelize.define(
    "Subcategory",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      type: { 
        type: DataTypes.ENUM("individual", "company"),
        allowNull: false,
        defaultValue: "individual"
      },
    },
    { tableName: "subcategories", timestamps: true }
  );
  return Subcategory;
};
