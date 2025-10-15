const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserBlock = sequelize.define(
    "UserBlock",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      blockerId: { type: DataTypes.UUID, allowNull: false },
      blockedId: { type: DataTypes.UUID, allowNull: false },
      note: { type: DataTypes.STRING(500), allowNull: true },
    },
    {
      tableName: "user_blocks",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["blockerId", "blockedId"] },
        { fields: ["blockerId"] },
        { fields: ["blockedId"] },
      ],
    }
  );
  return UserBlock;
};
