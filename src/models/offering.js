// backend/src/models/offering.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Offering = sequelize.define(
    "Offering",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },

      // Who created the offering
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      // What kind of offering is this? (job, event, product, etc.)
      type: {
        type: DataTypes.ENUM(
          "job",
          "event",
          "funding",
          "service",
          "product",
          "tourism",
          "moment"
        ),
        allowNull: false,
      },

      // Intent of the post
      intent: {
          // 'offer' -> I'm offering e.g a job/service/product/event
        // 'seek'  -> I'm looking for e.g a a job/service/product/funding
        // 'share' -> I'm sharing a e.g a moment/info/announcement
        type: DataTypes.ENUM("offer", "seek", "share"),
        allowNull: false,
        defaultValue: "share",
      },

      // Basic details
      title: { type: DataTypes.STRING(180), allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: false },
      lookingFor: { type: DataTypes.STRING(240), allowNull: true },

      // Location
      country: { type: DataTypes.STRING(80), allowNull: true },
      city: { type: DataTypes.STRING(120), allowNull: true },
      locationType: {
        type: DataTypes.ENUM("onsite", "remote", "hybrid", "online"),
        allowNull: true,
      },

      // Media
      images: { type: DataTypes.JSON, defaultValue: [] },
      attachments: { type: DataTypes.JSON, defaultValue: [] },
      tags: { type: DataTypes.JSON, defaultValue: [] },

      // Classification
      categoryId: { type: DataTypes.UUID, allowNull: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: true },
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
      tableName: "offerings",
      timestamps: true,
    }
  );

  Offering.associate = (models) => {
    Offering.belongsTo(models.User, { foreignKey: "userId", as: "user" });

    Offering.belongsTo(models.Category, { foreignKey: "categoryId", as: "category" });
    Offering.belongsTo(models.Subcategory, { foreignKey: "subcategoryId", as: "subcategory" });
    Offering.belongsTo(models.SubsubCategory, { foreignKey: "subsubCategoryId", as: "subsubCategory" });

    Offering.belongsTo(models.IndustryCategory, {
      foreignKey: "industryCategoryId",
      as: "industryCategory",
    });
    Offering.belongsTo(models.IndustrySubcategory, {
      foreignKey: "industrySubcategoryId",
      as: "industrySubcategory",
    });
    Offering.belongsTo(models.IndustrySubsubCategory, {
      foreignKey: "industrySubsubCategoryId",
      as: "industrySubsubCategory",
    });

    Offering.hasMany(models.Comment, {
      foreignKey: "entityId",
      constraints: false,
      scope: { entityType: "offering" },
    });
  };

  return Offering;
};
