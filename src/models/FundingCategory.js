module.exports = (sequelize, DataTypes) => {
  const FundingCategory = sequelize.define(
    "FundingCategory",
    {
      fundingId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "funding_categories", timestamps: false }
  );
  return FundingCategory;
};