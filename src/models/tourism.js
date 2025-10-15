const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Tourism = sequelize.define(
    "Tourism",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Who posted the tourism content
      authorUserId: { type: DataTypes.UUID, allowNull: false },

      // Post type
      postType: { 
        type: DataTypes.ENUM('Destination', 'Experience', 'Culture'), 
        defaultValue: 'Destination',
        allowNull: false 
      },

      // Basic info
      title: { type: DataTypes.STRING(180), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },

      // Location
      country: { type: DataTypes.STRING(80), allowNull: false },
      location: { type: DataTypes.STRING(100), allowNull: true },

      // Additional details
      season: { type: DataTypes.STRING(50), allowNull: true },
      budgetRange: { type: DataTypes.STRING(50), allowNull: true },

      // Tags & Images
      tags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      images: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },

      moderation_status: {
        type: DataTypes.ENUM("approved", "reported", "under_review", "removed", "suspended"),
        defaultValue: "approved"
      },
    },
    {
      tableName: "tourism",
      timestamps: true,
      indexes: [{ fields: ["authorUserId"] }],
    }
  );

  Tourism.associate = (models) => {
    Tourism.belongsTo(models.User, { foreignKey: "authorUserId", as: "author" });
    
    // Many-to-many audience associations
    Tourism.belongsToMany(models.Identity, {
      through: "tourism_identities",
      foreignKey: "tourismId",
      otherKey: "identityId",
      as: "audienceIdentities",
    });
    
    Tourism.belongsToMany(models.Category, {
      through: "tourism_categories",
      foreignKey: "tourismId",
      otherKey: "categoryId",
      as: "audienceCategories",
    });
    
    Tourism.belongsToMany(models.Subcategory, {
      through: "tourism_subcategories",
      foreignKey: "tourismId",
      otherKey: "subcategoryId",
      as: "audienceSubcategories",
    });
    
    Tourism.belongsToMany(models.SubsubCategory, {
      through: "tourism_subsubcategories",
      foreignKey: "tourismId",
      otherKey: "subsubCategoryId",
      as: "audienceSubsubs",
    });
  };

  return Tourism;
};