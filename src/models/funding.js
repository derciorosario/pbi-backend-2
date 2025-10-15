const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Funding = sequelize.define(
    "Funding",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Who created the funding project
      creatorUserId: { type: DataTypes.UUID, allowNull: false },

      // Basic info
      title: { type: DataTypes.STRING(180), allowNull: false },
      pitch: { type: DataTypes.TEXT, allowNull: false },
      
      // Category
      categoryId: { type: DataTypes.UUID, allowNull: true },

      // Funding details
      goal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      raised: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: "USD" },
      deadline: { type: DataTypes.DATEONLY, allowNull: false },
      
      // Location
      country: { type: DataTypes.STRING(80), allowNull: false },
      city: { type: DataTypes.STRING(100), allowNull: true },

      // Additional details
      rewards: { type: DataTypes.TEXT, allowNull: true },
      team: { type: DataTypes.TEXT, allowNull: true },
      
      // Contact info
      email: { type: DataTypes.STRING(100), allowNull: true },
      phone: { type: DataTypes.STRING(30), allowNull: true },

      // Status and visibility
      status: { 
        type: DataTypes.ENUM('draft', 'published', 'funded', 'closed'), 
        defaultValue: 'draft',
        allowNull: false 
      },
      visibility: { 
        type: DataTypes.ENUM('public', 'private'), 
        defaultValue: 'public',
        allowNull: false 
      },

      // Tags, Links & Images
      tags: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      links: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      images: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },

      moderation_status: {
        type: DataTypes.ENUM("approved", "reported", "under_review", "removed", "suspended"),
        defaultValue: "approved"
      },
    },
    {
      tableName: "funding",
      timestamps: true,
      indexes: [{ fields: ["creatorUserId"] }, { fields: ["categoryId"] }],
    }
  );

  Funding.associate = (models) => {
    Funding.belongsTo(models.User, { foreignKey: "creatorUserId", as: "creator" });
    Funding.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
    
    // Many-to-many audience associations
    Funding.belongsToMany(models.Identity, {
      through: "funding_identities",
      foreignKey: "fundingId",
      otherKey: "identityId",
      as: "audienceIdentities",
    });
    
    Funding.belongsToMany(models.Category, {
      through: "funding_categories",
      foreignKey: "fundingId",
      otherKey: "categoryId",
      as: "audienceCategories",
    });
    
    Funding.belongsToMany(models.Subcategory, {
      through: "funding_subcategories",
      foreignKey: "fundingId",
      otherKey: "subcategoryId",
      as: "audienceSubcategories",
    });
    
    Funding.belongsToMany(models.SubsubCategory, {
      through: "funding_subsubcategories",
      foreignKey: "fundingId",
      otherKey: "subsubCategoryId",
      as: "audienceSubsubs",
    });
  };

  return Funding;
};