module.exports = (sequelize, DataTypes) => {
  const NeedSubsubCategory = sequelize.define(
    "NeedSubsubCategory",
    {
      needId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "needs", key: "id" },
        onDelete: "CASCADE",
      },
      subsubCategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "subsubcategories", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "need_subsubcategories",
      timestamps: false,
      indexes: [
        { unique: true, fields: ["needId", "subsubCategoryId"] },
        { fields: ["subsubCategoryId"] },
      ],
    }
  );

  return NeedSubsubCategory;
};