module.exports = (sequelize, DataTypes) => {
  const ServiceSubsubCategory = sequelize.define(
    "ServiceSubsubCategory",
    {
      serviceId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "service_subsubcategories", timestamps: false }
  );
  return ServiceSubsubCategory;
};