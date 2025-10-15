const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define(
    "Category",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: true }, // ← can be null
      name: { type: DataTypes.STRING(160), allowNull: false },
      sort: { type: DataTypes.INTEGER, defaultValue: 0 },
      meta: { type: DataTypes.JSON, allowNull: true },
      type: { 
        type: DataTypes.ENUM("individual", "company"),
        allowNull: false,
        defaultValue: "individual"
      },
    },
    {
      tableName: "categories",
      timestamps: true,
      indexes: [
        { fields: ["identityId"] },
        //{ fields: ["name"] },
      ],
    }
  );

  return Category;
};
