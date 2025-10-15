// models/ProductIdentity.js
module.exports = (sequelize, DataTypes) => {
  const ProductIdentity = sequelize.define(
    "ProductIdentity",
    {
      productId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "product_identities", timestamps: false }
  );
  return ProductIdentity;
};