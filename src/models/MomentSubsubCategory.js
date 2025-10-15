// models/MomentSubsubCategory.js
module.exports = (sequelize, DataTypes) => {
  const MomentSubsubCategory = sequelize.define(
    "MomentSubsubCategory",
    {
      momentId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "moment_subsubcategories", timestamps: false }
  );
  return MomentSubsubCategory;
};