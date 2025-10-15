// models/userSubcategoryInterest.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserSubcategoryInterest = sequelize.define("UserSubcategoryInterest", {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId:        { type: DataTypes.UUID, allowNull: false },
    subcategoryId: { type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: "user_subcategories_interests",
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId","subcategoryId"] }],
  });
  return UserSubcategoryInterest;
};
