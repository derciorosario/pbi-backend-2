// goal.js
const { v4: uuidv4 } = require("uuid");
module.exports = (sequelize, DataTypes) => {
  const Goal = sequelize.define(
    "Goal",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: "goals", timestamps: true }
  );
  return Goal;
};
