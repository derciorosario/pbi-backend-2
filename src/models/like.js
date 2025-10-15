const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Like = sequelize.define(
    "Like",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      targetType: { 
        type: DataTypes.STRING(), 
        allowNull: false 
      },
      targetId: { type: DataTypes.UUID, allowNull: false },
    },
    {
      tableName: "likes",
      timestamps: true,
      indexes: [
        { fields: ["userId"] },
        { fields: ["targetType", "targetId"] },
        { unique: true, fields: ["userId", "targetType", "targetId"] }, // Prevent duplicate likes
      ],
    }
  );

  Like.associate = (models) => {
    Like.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return Like;
};