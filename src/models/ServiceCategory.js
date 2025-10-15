module.exports = (sequelize, DataTypes) => {
  const ServiceCategory = sequelize.define(
    "ServiceCategory",
    {
      serviceId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "service_categories", timestamps: false }
  );
  return ServiceCategory;
};