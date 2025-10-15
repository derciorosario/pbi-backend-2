module.exports = (sequelize, DataTypes) => {
  const ProductSubcategory = sequelize.define(
    "ProductSubcategory",
    {
      productId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "product_subcategories", timestamps: false }
  );
  return ProductSubcategory;
};