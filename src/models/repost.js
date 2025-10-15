const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Repost = sequelize.define(
    "Repost",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      targetType: { 
        type: DataTypes.STRING(),
        allowNull: false 
      },
      targetId: { type: DataTypes.UUID, allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: true }, // Optional comment with the repost
    },
    {
      tableName: "reposts",
      timestamps: true,
      indexes: [
        { fields: ["userId"] },
        { fields: ["targetType", "targetId"] },
        { unique: true, fields: ["userId", "targetType", "targetId"] }, // Prevent duplicate reposts
      ],
    }
  );

  Repost.associate = (models) => {
    Repost.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return Repost;
};