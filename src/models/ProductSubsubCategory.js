module.exports = (sequelize, DataTypes) => {
  const ProductSubsubCategory = sequelize.define(
    "ProductSubsubCategory",
    {
      productId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "product_subsubcategories", timestamps: false }
  );
  return ProductSubsubCategory;
};