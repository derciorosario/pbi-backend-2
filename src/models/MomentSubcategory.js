// models/MomentSubcategory.js
module.exports = (sequelize, DataTypes) => {
  const MomentSubcategory = sequelize.define(
    "MomentSubcategory",
    {
      momentId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "moment_subcategories", timestamps: false }
  );
  return MomentSubcategory;
};