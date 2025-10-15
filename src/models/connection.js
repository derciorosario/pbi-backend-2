const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Connection = sequelize.define(
    "Connection",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userOneId: { type: DataTypes.UUID, allowNull: false },
      userTwoId: { type: DataTypes.UUID, allowNull: false },
    },
    {
      tableName: "connections",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["userOneId", "userTwoId"] },
        { fields: ["userOneId"] },
        { fields: ["userTwoId"] },
      ],
    }
  );

  Connection.associate = (models) => {
    Connection.belongsTo(models.User, { foreignKey: "userOneId", as: "userOne" });
    Connection.belongsTo(models.User, { foreignKey: "userTwoId", as: "userTwo" });
  };

  return Connection;
};
