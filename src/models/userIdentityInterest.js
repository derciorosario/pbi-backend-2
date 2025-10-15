// models/userIdentityInterest.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserIdentityInterest = sequelize.define("UserIdentityInterest", {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId:     { type: DataTypes.UUID, allowNull: false },
    identityId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: "user_identity_interests",
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId","identityId"] }],
  });
  return UserIdentityInterest;
};
