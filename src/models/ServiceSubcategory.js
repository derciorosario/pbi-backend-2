module.exports = (sequelize, DataTypes) => {
  const ServiceSubcategory = sequelize.define(
    "ServiceSubcategory",
    {
      serviceId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "service_subcategories", timestamps: false }
  );
  return ServiceSubcategory;
};