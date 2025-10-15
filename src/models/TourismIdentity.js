module.exports = (sequelize, DataTypes) => {
  const TourismIdentity = sequelize.define(
    "TourismIdentity",
    {
      tourismId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "tourism_identities", timestamps: false }
  );
  return TourismIdentity;
};