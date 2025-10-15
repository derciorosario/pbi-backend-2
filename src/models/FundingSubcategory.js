module.exports = (sequelize, DataTypes) => {
  const FundingSubcategory = sequelize.define(
    "FundingSubcategory",
    {
      fundingId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "funding_subcategories", timestamps: false }
  );
  return FundingSubcategory;
};