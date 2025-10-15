const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Service = sequelize.define(
    "Service",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Who provides the service
      providerUserId: { type: DataTypes.UUID, allowNull: false },

      // Basic info
      title: { type: DataTypes.STRING(180), allowNull: false },
      serviceType: { 
        type: DataTypes.ENUM("Consulting", "Freelance Work", "Managed Services"), 
        allowNull: false,
        defaultValue: "Consulting"
      },
      currency: { type: DataTypes.STRING(10), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: false },

      // Pricing
      priceAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      priceType: { 
        type: DataTypes.ENUM("Fixed Price", "Hourly"), 
        allowNull: false,
        defaultValue: "Fixed Price"
      },
      deliveryTime: { 
        type: DataTypes.ENUM("1 Day", "3 Days", "1 Week", "2 Weeks", "1 Month"), 
        allowNull: false,
        defaultValue: "1 Week"
      },

      // Location & Experience
      locationType: { 
        type: DataTypes.ENUM("Remote", "On-site"), 
        allowNull: false,
        defaultValue: "Remote"
      },
      experienceLevel: { 
        type: DataTypes.ENUM("Entry Level", "Intermediate", "Expert"), 
        allowNull: false,
        defaultValue: "Intermediate"
      },
      country: { type: DataTypes.STRING(80), allowNull: true },
      city: { type: DataTypes.STRING(120), allowNull: true },

      // Skills & Attachments
      skills: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      attachments: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },

      moderation_status: {
        type: DataTypes.ENUM("approved", "reported", "under_review", "removed", "suspended"),
        defaultValue: "approved"
      },
    },
    {
      tableName: "services",
      timestamps: true,
      indexes: [{ fields: ["providerUserId"] }],
    }
  );

  Service.associate = (models) => {
    Service.belongsTo(models.User, { foreignKey: "providerUserId", as: "provider" });
  };

  return Service;
};