module.exports = (sequelize, DataTypes) => {
  const FundingIdentity = sequelize.define(
    "FundingIdentity",
    {
      fundingId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "funding_identities", timestamps: false }
  );
  return FundingIdentity;
};