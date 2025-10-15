const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },           // destinatário
      type:   { type: DataTypes.STRING(60), allowNull: false },     // e.g. "connection.request", "connection.accepted","connection.rejected","meeting_request","meeting_response"
      payload:{ type: DataTypes.JSON, allowNull: true },            // { fromUserId, fromName, requestId, ... }
      readAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "notifications",
      timestamps: true,
      indexes: [{ fields: ["userId"] }, { fields: ["type"] }, { fields: ["readAt"] }],
    }
  );
  return Notification;
};
