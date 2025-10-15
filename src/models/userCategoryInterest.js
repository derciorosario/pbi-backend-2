// models/userCategoryInterest.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserCategoryInterest = sequelize.define("UserCategoryInterest", {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId:     { type: DataTypes.UUID, allowNull: false },
    categoryId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: "user_categories_interests",
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId","categoryId"] }],
  });
  return UserCategoryInterest;
};
