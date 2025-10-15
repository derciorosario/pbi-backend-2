const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define(
    "Product",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Who sells the product
      sellerUserId: { type: DataTypes.UUID, allowNull: false },

      // Basic info
      title: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },

      currency: { type: DataTypes.STRING(10), allowNull: true },

      // Pricing & Inventory
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: true },

      // Location
      country: { type: DataTypes.STRING(80), allowNull: true },
      city: { type: DataTypes.STRING(80), allowNull: true },

      // Tags & Images
      tags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      images: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },

      moderation_status: {
        type: DataTypes.ENUM("approved", "reported", "under_review", "removed", "suspended"),
        defaultValue: "approved"
      },
    },
    {
      tableName: "products",
      timestamps: true,
      indexes: [{ fields: ["sellerUserId"] }],
    }
  );

  Product.associate = (models) => {
    Product.belongsTo(models.User, { foreignKey: "sellerUserId", as: "seller" });

    // Many-to-many audience associations
    Product.belongsToMany(models.Identity, {
      through: "product_identities",
      foreignKey: "productId",
      otherKey: "identityId",
      as: "audienceIdentities",
    });
    
    Product.belongsToMany(models.Category, {
      through: "product_categories",
      foreignKey: "productId",
      otherKey: "categoryId",
      as: "audienceCategories",
    });
    
    Product.belongsToMany(models.Subcategory, {
      through: "product_subcategories",
      foreignKey: "productId",
      otherKey: "subcategoryId",
      as: "audienceSubcategories",
    });
    
    Product.belongsToMany(models.SubsubCategory, {
      through: "product_subsubcategories",
      foreignKey: "productId",
      otherKey: "subsubCategoryId",
      as: "audienceSubsubs",
    });
  };

  return Product;
};