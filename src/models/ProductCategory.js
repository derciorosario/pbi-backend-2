module.exports = (sequelize, DataTypes) => {
  const ProductCategory = sequelize.define(
    "ProductCategory",
    {
      productId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "product_categories", timestamps: false }
  );
  return ProductCategory;
};