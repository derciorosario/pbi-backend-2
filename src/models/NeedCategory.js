module.exports = (sequelize, DataTypes) => {
  const NeedCategory = sequelize.define(
    "NeedCategory",
    {
      needId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "needs", key: "id" },
        onDelete: "CASCADE",
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "categories", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "need_categories",
      timestamps: false,
      indexes: [
        { unique: true, fields: ["needId", "categoryId"] },
        { fields: ["categoryId"] },
      ],
    }
  );

  return NeedCategory;
};