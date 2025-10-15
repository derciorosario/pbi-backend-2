module.exports = (sequelize, DataTypes) => {
  const FundingSubsubCategory = sequelize.define(
    "FundingSubsubCategory",
    {
      fundingId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "funding_subsubcategories", timestamps: false }
  );
  return FundingSubsubCategory;
};