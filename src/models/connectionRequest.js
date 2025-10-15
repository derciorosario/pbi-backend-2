const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const ConnectionRequest = sequelize.define(
    "ConnectionRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      fromUserId: { type: DataTypes.UUID, allowNull: false },
      toUserId:   { type: DataTypes.UUID, allowNull: false },
      reason:     { type: DataTypes.STRING(160), allowNull: true },
      message:    { type: DataTypes.TEXT, allowNull: true },
      status:     { type: DataTypes.ENUM("pending", "accepted", "rejected"), defaultValue: "pending" },
      respondedAt:{ type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "connection_requests",
      timestamps: true,
      indexes: [
        { fields: ["fromUserId"] },
        { fields: ["toUserId"] },
        { unique: true, fields: ["fromUserId", "toUserId", "status"] }, // impede múltiplos "pending" iguais
      ],
    }
  );
  return ConnectionRequest;
};
