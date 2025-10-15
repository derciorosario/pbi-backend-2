// backend/src/models/need.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Need = sequelize.define(
    "Need",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },

      // Who is posting the need
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // Basic information
      title: {
        type: DataTypes.STRING(180),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: false,
      },

      // Budget & Urgency
      budget: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      urgency: {
        type: DataTypes.ENUM("Low", "Medium", "High", "Urgent"),
        allowNull: false,
        defaultValue: "Medium",
      },

      // Location
      location: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },

      // Specific criteria/requirements
      criteria: {
        type: DataTypes.JSON,
        defaultValue: [],
      },

      // Attachments (array of { name, base64url })
      attachments: {
        type: DataTypes.JSON,
        defaultValue: [],
      },

      // Related entity (optional)
      relatedEntityType: {
        type: DataTypes.ENUM(
          "job",
          "product",
          "service",
          "event",
          "partnership",
          "funding",
          "information",
          "tourism",
          "other"
        ),
        allowNull: true,
      },
      relatedEntityId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // General taxonomy (nullable)
      generalCategoryId: { type: DataTypes.UUID, allowNull: true },
      generalSubcategoryId: { type: DataTypes.UUID, allowNull: true },
      generalSubsubCategoryId: { type: DataTypes.UUID, allowNull: true },

      // Industry taxonomy (nullable)
      industryCategoryId: { type: DataTypes.UUID, allowNull: true },
      industrySubcategoryId: { type: DataTypes.UUID, allowNull: true },
      industrySubsubCategoryId: { type: DataTypes.UUID, allowNull: true },

      // Moderation
      moderation_status: {
        type: DataTypes.ENUM("approved", "reported", "under_review", "removed", "suspended"),
        defaultValue: "approved",
      },

      publishedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "needs",
      timestamps: true,
      indexes: [
        { fields: ["userId", "publishedAt"] },
        { fields: ["relatedEntityType", "relatedEntityId"] },
        { fields: ["urgency", "publishedAt"] },
        // Temporarily disabled until database migration
        // { fields: ["generalCategoryId", "generalSubcategoryId", "publishedAt"] },
        { fields: ["industryCategoryId", "industrySubcategoryId", "publishedAt"] },
      ],
    }
  );

  Need.associate = (models) => {
    Need.belongsTo(models.User, { foreignKey: "userId", as: "user" });

    Need.belongsTo(models.IndustryCategory, {
      foreignKey: "industryCategoryId",
      as: "primaryIndustryCategory",
    });
    Need.belongsTo(models.IndustrySubcategory, {
      foreignKey: "industrySubcategoryId",
      as: "primaryIndustrySubcategory",
    });
    Need.belongsTo(models.IndustrySubsubCategory, {
      foreignKey: "industrySubsubCategoryId",
      as: "primaryIndustrySubsubCategory",
    });

    // Comments
    Need.hasMany(models.Comment, {
      foreignKey: "entityId",
      constraints: false,
      scope: { entityType: "need" },
    });
  };

  return Need;
};
