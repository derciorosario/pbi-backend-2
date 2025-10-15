const { v4: uuidv4 } = require("uuid");
module.exports = (sequelize, DataTypes) => {
  const UserSubsubCategory = sequelize.define("UserSubsubCategory", {
    id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
    userId:          { type: DataTypes.UUID, allowNull: false },
    subsubCategoryId:{ type: DataTypes.UUID, allowNull: false },
  }, {
    tableName: "user_subsubcategories",
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId","subsubCategoryId"] }],
  });
  return UserSubsubCategory;
};
