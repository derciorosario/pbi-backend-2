const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define(
    "Event",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Who created/owns the event
      organizerUserId: { type: DataTypes.UUID, allowNull: false },

      // Basics
      title: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      eventType: {
        type: DataTypes.ENUM("Workshop", "Conference", "Networking"),
        allowNull: false,
        defaultValue: "Workshop",
      },

      // Industry (Category/Subcategory)
      categoryId: { type: DataTypes.UUID, allowNull: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: true },

      // Date & Time
      startAt: { type: DataTypes.DATE, allowNull: false },
      endAt: { type: DataTypes.DATE, allowNull: true },
      timezone: { type: DataTypes.STRING(64), allowNull: true }, // e.g. "Africa/Lagos"

      // Location
      locationType: {
        type: DataTypes.ENUM("In-Person", "Virtual", "Hybrid"),
        allowNull: false,
        defaultValue: "In-Person",
      },
      country: { type: DataTypes.STRING(80), allowNull: true },
      city: { type: DataTypes.STRING(80), allowNull: true },
      address: { type: DataTypes.STRING(240), allowNull: true },
      onlineUrl: { type: DataTypes.STRING(500), allowNull: true },

      // Registration
      registrationType: {
        type: DataTypes.ENUM("Free", "Paid"),
        allowNull: false,
        defaultValue: "Free",
      },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
      currency: { type: DataTypes.STRING(10), allowNull: true },
      capacity: { type: DataTypes.INTEGER, allowNull: true },
      registrationDeadline: { type: DataTypes.DATE, allowNull: true },

      coverImageBase64: { type: DataTypes.TEXT('long'), allowNull: true },

      // Media
      coverImageUrl: { type: DataTypes.TEXT('long'), allowNull: true },

      moderation_status: {
        type: DataTypes.ENUM("approved", "reported", "under_review", "removed", "suspended"),
        defaultValue: "approved"
      },
    },
    {
      tableName: "events",
      timestamps: true,
    }
  );

  return Event;
};
