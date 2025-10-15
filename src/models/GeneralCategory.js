const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const GeneralCategory = sequelize.define(
    "GeneralCategory",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(180), allowNull: false },
      type: {
        type: DataTypes.ENUM("job", "event", "product", "service", "tourism", "opportunity"),
        allowNull: false,
      },
    },
    { tableName: "general_categories", timestamps: true }
  );

  return GeneralCategory;
};
