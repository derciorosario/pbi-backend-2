// backend/src/models/moment.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Moment = sequelize.define(
    "Moment",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },

      // User who shared the moment
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

      // Moment type and classification
      type: {
        type: DataTypes.ENUM(
          "Achievement",
          "Milestone",
          "Learning",
          "Challenge",
          "Opportunity"
        ),
        allowNull: false,
      },

      // When the moment occurred
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      // Media content
      images: {
        type: DataTypes.JSON,
        defaultValue: [],
      },
      attachments: {
        type: DataTypes.JSON,
        defaultValue: [],
      },

      // Tagging and categorization
      tags: {
        type: DataTypes.JSON,
        defaultValue: [],
      },

      // Contextual information
      location: {
        type: DataTypes.STRING(100),
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

      // Direct classification (all optional)
      industryCategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      industrySubcategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      industrySubsubCategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      generalCategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      generalSubcategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      generalSubsubCategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // Related entity (job, event, funding, etc.)
      relatedEntityType: {
        type: DataTypes.ENUM(
          "job",
          "event",
          "product",
          "service",
          "tourism",
          "funding"
        ),
        allowNull: true,
      },
      relatedEntityId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      // Moderation
      moderation_status: {
        type: DataTypes.ENUM(
          "approved",
          "reported",
          "under_review",
          "removed",
          "suspended"
        ),
        defaultValue: "approved",
      },

      // Publication date (separate from createdAt)
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "moments",
      timestamps: true,
    }
  );

  Moment.associate = (models) => {
    // User who created the moment
    Moment.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });

    // Industry category links are handled by attachIndustryTaxonomy in models/index.js

    // Comments
    Moment.hasMany(models.Comment, {
      foreignKey: "entityId",
      constraints: false,
      scope: { entityType: "moment" },
    });
  };

  return Moment;
};
