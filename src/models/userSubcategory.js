module.exports = (sequelize, DataTypes) => {
  const UserSubcategory = sequelize.define(
    "UserSubcategory",
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, primaryKey: true },
    },
    { tableName: "users_subcategories", timestamps: true }
  );
  return UserSubcategory;
};
