const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Report = sequelize.define(
    "Report",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      reporterId: { type: DataTypes.UUID, allowNull: false },
      targetType: {
        type: DataTypes.STRING(),
        allowNull: false
      },
      targetId:   { type: DataTypes.UUID, allowNull: false },
      category:   {
        type: DataTypes.ENUM(
          "spam",
          "harassment",
          "scam",
          "impersonation",
          "inappropriate_content",
          "false_information",
          "intellectual_property",
          "other"
        ),
        defaultValue: "other"
      },
      description:{ type: DataTypes.TEXT, allowNull: false },
      status:     { type: DataTypes.ENUM("open", "reviewed", "dismissed"), defaultValue: "open" },
      handledAt:  { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "reports",
      timestamps: true,
      indexes: [
        { fields: ["reporterId"] },
        { fields: ["targetType", "targetId"] },
        { fields: ["status"] },
      ],
    }
  );
  Report.associate = (models) => {
    Report.belongsTo(models.User, { foreignKey: "reporterId", as: "reporter" });
  };

  return Report;
};
