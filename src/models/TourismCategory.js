module.exports = (sequelize, DataTypes) => {
  const TourismCategory = sequelize.define(
    "TourismCategory",
    {
      tourismId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "tourism_categories", timestamps: false }
  );
  return TourismCategory;
};