module.exports = (sequelize, DataTypes) => {
  const NeedIdentity = sequelize.define(
    "NeedIdentity",
    {
      needId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "needs", key: "id" },
        onDelete: "CASCADE",
      },
      identityId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "identities", key: "id" },
        onDelete: "CASCADE",
      },
    },
    {
      tableName: "need_identities",
      timestamps: false,
      indexes: [
        { unique: true, fields: ["needId", "identityId"] },
        { fields: ["identityId"] },
      ],
    }
  );

  return NeedIdentity;
};