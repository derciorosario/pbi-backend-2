// models/EventIdentity.js
module.exports = (sequelize, DataTypes) => {
  const EventIdentity = sequelize.define(
    "EventIdentity",
    {
      eventId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "event_identities", timestamps: false }
  );
  return EventIdentity;
};