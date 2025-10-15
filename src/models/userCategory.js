module.exports = (sequelize, DataTypes) => {
  const UserCategory = sequelize.define(
    "UserCategory",
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      categoryId: { type: DataTypes.UUID, primaryKey: true },
    },
    { tableName: "users_categories", timestamps: true }
  );
  return UserCategory;
};
