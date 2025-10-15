const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define(
    "Contact",
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
      contactReason: {
        type: DataTypes.ENUM(
          "complaint",
          "partnership",
          "information",
          "other"
        ),
        allowNull: false,
        defaultValue: "other"
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Message is required" },
          len: { args: [10, 2000], msg: "Message must be between 10 and 2000 characters" }
        }
      },
      companyName: {
        type: DataTypes.STRING,
        allowNull: true,
        set(val) {
          // Convert empty strings to null
          this.setDataValue('companyName', val === '' ? null : val);
        },
        validate: {
          len: {
            args: [2, 100],
            msg: "Company name must be between 2 and 100 characters"
          }
        }
      },
      website: {
        type: DataTypes.STRING,
        allowNull: true,
        set(val) {
          // Convert empty strings to null
          this.setDataValue('website', val === '' ? null : val);
        },
        validate: {
          isUrl: {
            msg: "Please provide a valid website URL"
          }
        }
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
      }
    },
    {
      tableName: "contacts",
      timestamps: true,
      indexes: [
        { fields: ["email"] },
        { fields: ["contactReason"] },
        { fields: ["status"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  return Contact;
};