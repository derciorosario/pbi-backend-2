const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Support = sequelize.define(
    "Support",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Full name is required" },
          len: { args: [2, 100], msg: "Full name must be between 2 and 100 characters" }
        }
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isEmail: { msg: "Please provide a valid email address" },
          notEmpty: { msg: "Email is required" }
        }
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
        set(val) {
          // Convert empty strings to null
          this.setDataValue('phone', val === '' ? null : val);
        },
        validate: {
          len: {
            args: [6, 20],
            msg: "Phone number must be between 6 and 20 characters",
            if: function(val) {
              return val && val.length > 0;
            }
          }
        }
      },
      supportReason: {
        type: DataTypes.ENUM(
          "technical",
          "account",
          "data",
          "general",
          "other"
        ),
        allowNull: false,
        defaultValue: "other"
      },
      priority: {
        type: DataTypes.ENUM("low", "medium", "high"),
        allowNull: false,
        defaultValue: "medium"
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      attachment: {
        type: DataTypes.STRING,
        allowNull: true
      },
      attachmentName: {
        type: DataTypes.STRING,
        allowNull: true
      },
      attachmentType: {
        type: DataTypes.STRING,
        allowNull: true
      },
      status: {
        type: DataTypes.ENUM("new", "in_progress", "responded", "closed"),
        allowNull: false,
        defaultValue: "new"
      },
      respondedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      readAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
      }
    },
    {
      tableName: "supports",
      timestamps: true,
      indexes: [
        { fields: ["email"] },
        { fields: ["supportReason"] },
        { fields: ["priority"] },
        { fields: ["status"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  return Support;
};