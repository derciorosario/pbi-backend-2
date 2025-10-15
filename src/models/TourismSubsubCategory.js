module.exports = (sequelize, DataTypes) => {
  const TourismSubsubCategory = sequelize.define(
    "TourismSubsubCategory",
    {
      tourismId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "tourism_subsubcategories", timestamps: false }
  );
  return TourismSubsubCategory;
};