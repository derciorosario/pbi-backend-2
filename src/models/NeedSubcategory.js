module.exports = (sequelize, DataTypes) => {
  const NeedSubcategory = sequelize.define(
    "NeedSubcategory",
    {
      needId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "needs", key: "id" },
        onDelete: "CASCADE",
      },
      subcategoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "subcategories", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "need_subcategories",
      timestamps: false,
      indexes: [
        { unique: true, fields: ["needId", "subcategoryId"] },
        { fields: ["subcategoryId"] },
      ],
    }
  );

  return NeedSubcategory;
};