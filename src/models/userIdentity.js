const { v4: uuidv4 } = require("uuid");
module.exports = (sequelize, DataTypes) => {
  const UserIdentity = sequelize.define("UserIdentity", {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId:     { type: DataTypes.UUID, allowNull: false },
    identityId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: "user_identities",
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId","identityId"] }],
  });

  UserIdentity.associate = (models) => {
    UserIdentity.belongsTo(models.User, { foreignKey: "userId", as: "userProfile" });
    UserIdentity.belongsTo(models.Identity, { foreignKey: "identityId", as: "identity" });
  };

  return UserIdentity;
};
