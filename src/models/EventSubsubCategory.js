module.exports = (sequelize, DataTypes) => {
  const EventSubsubCategory = sequelize.define(
    "EventSubsubCategory",
    {
      eventId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "event_subsubcategories", timestamps: false }
  );
  return EventSubsubCategory;
};