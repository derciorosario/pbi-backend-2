// models/MomentIdentity.js
module.exports = (sequelize, DataTypes) => {
  const MomentIdentity = sequelize.define(
    "MomentIdentity",
    {
      momentId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "moment_identities", timestamps: false }
  );
  return MomentIdentity;
};