module.exports = (sequelize, DataTypes) => {
  const EventSubcategory = sequelize.define(
    "EventSubcategory",
    {
      eventId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "event_subcategories", timestamps: false }
  );
  return EventSubcategory;
};