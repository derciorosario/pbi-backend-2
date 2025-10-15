// models/MomentCategory.js
module.exports = (sequelize, DataTypes) => {
  const MomentCategory = sequelize.define(
    "MomentCategory",
    {
      momentId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "moment_categories", timestamps: false }
  );
  return MomentCategory;
};