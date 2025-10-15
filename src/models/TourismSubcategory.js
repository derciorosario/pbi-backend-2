module.exports = (sequelize, DataTypes) => {
  const TourismSubcategory = sequelize.define(
    "TourismSubcategory",
    {
      tourismId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "tourism_subcategories", timestamps: false }
  );
  return TourismSubcategory;
};