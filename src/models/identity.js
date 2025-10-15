const { v4: uuidv4 } = require("uuid");
module.exports = (sequelize, DataTypes) => {
  const Identity = sequelize.define(
    "Identity",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      type: { 
        type: DataTypes.ENUM("individual", "company","none"),
        allowNull: false,
        defaultValue: "individual"
      },
    },
    { tableName: "identities", timestamps: true }
  );
  return Identity;
};
