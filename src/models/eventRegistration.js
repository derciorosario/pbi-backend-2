const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const EventRegistration = sequelize.define(
    "EventRegistration",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Registrant
      userId: { type: DataTypes.UUID, allowNull: false },

      // Event
      eventId: { type: DataTypes.UUID, allowNull: false },

      // Registration details
      numberOfPeople: { type: DataTypes.INTEGER, allowNull: false },
      reasonForAttending: { type: DataTypes.TEXT, allowNull: false },

      // Status
      status: {
        type: DataTypes.ENUM("pending", "confirmed", "cancelled"),
        defaultValue: "pending"
      },
    },
    {
      tableName: "event_registrations",
      timestamps: true,
      indexes: [{ fields: ["userId", "eventId"] }],
    }
  );

  EventRegistration.associate = (models) => {
    EventRegistration.belongsTo(models.User, {
      as: "registrant",
      foreignKey: "userId",
      onDelete: "CASCADE",
    });
    EventRegistration.belongsTo(models.Event, {
      as: "event",
      foreignKey: "eventId",
      onDelete: "CASCADE",
    });
  };

  return EventRegistration;
};