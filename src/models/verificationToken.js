const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const VerificationToken = sequelize.define(
    "VerificationToken",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      token: { type: DataTypes.STRING, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      type: {
        type: DataTypes.ENUM("email_verify", "password_reset"),
        defaultValue: "email_verify",
      },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE },
    },
    { tableName: "verification_tokens", timestamps: true, }
  );

  return VerificationToken;
};
