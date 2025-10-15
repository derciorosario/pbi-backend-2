// userGoal.js
module.exports = (sequelize, DataTypes) => {
  const UserGoal = sequelize.define(
    "UserGoal",
    {
      userId: { type: DataTypes.UUID, primaryKey: true },
      goalId: { type: DataTypes.UUID, primaryKey: true },
    },
    { tableName: "users_goals", timestamps: true }
  );

  UserGoal.associate = (models) => {
    UserGoal.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    UserGoal.belongsTo(models.Goal, { foreignKey: "goalId", as: "goal" });
  };

  return UserGoal;
};
