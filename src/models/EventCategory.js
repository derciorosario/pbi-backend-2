module.exports = (sequelize, DataTypes) => {
  const EventCategory = sequelize.define(
    "EventCategory",
    {
      eventId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "event_categories", timestamps: false }
  );
  return EventCategory;
};