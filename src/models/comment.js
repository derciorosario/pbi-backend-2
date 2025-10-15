const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Comment = sequelize.define(
    "Comment",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      targetType: { 
        type: DataTypes.STRING(),
        allowNull: false 
      },
      targetId: { type: DataTypes.UUID, allowNull: false },
      parentCommentId: { type: DataTypes.UUID, allowNull: true }, // For replies to comments
      text: { type: DataTypes.TEXT, allowNull: false },
      status: { 
        type: DataTypes.ENUM("active", "hidden", "deleted"), 
        defaultValue: "active" 
      },
    },
    {
      tableName: "comments",
      timestamps: true,
      paranoid: true, // Soft delete
      indexes: [
        { fields: ["userId"] },
        { fields: ["targetType", "targetId"] },
        { fields: ["parentCommentId"] },
        { fields: ["status"] },
      ],
    }
  );

  Comment.associate = (models) => {
    Comment.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Comment.belongsTo(Comment, { foreignKey: "parentCommentId", as: "parentComment" });
    Comment.hasMany(Comment, { foreignKey: "parentCommentId", as: "replies" });
    Comment.hasMany(models.Like, { 
      foreignKey: "targetId", 
      constraints: false,
      scope: {
        targetType: "comment"
      },
      as: "likes" 
    });
  };

  return Comment;
};