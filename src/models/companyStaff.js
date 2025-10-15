const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const CompanyStaff = sequelize.define(
    "CompanyStaff",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      companyId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Company user ID (accountType='company')"
      },
      staffId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Staff user ID (accountType='individual')"
      },
      role: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: "employee",
        comment: "Staff role (employee, manager, contractor, etc.)"
      },
      status: {
        type: DataTypes.ENUM("pending", "confirmed", "rejected", "removed"),
        allowNull: false,
        defaultValue: "pending",
      },
      invitationToken: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Token for email invitation link"
      },
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rejectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      removedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      removedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "User who removed the staff member"
      },
      invitedBy: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "User who sent the invitation"
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Optional notes about the staff relationship"
      },
      isMain: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: "Whether this is the user's main/primary company"
      }
    },
    {
      tableName: "company_staff",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["companyId", "staffId"],
          name: "unique_company_staff"
        },
        {
          fields: ["status"],
          name: "idx_company_staff_status"
        },
        {
          fields: ["invitationToken"],
          name: "idx_company_staff_token"
        },
        {
          fields: ["role"],
          name: "idx_company_staff_role"
        }
      ]
    }
  );

  // Associations
  CompanyStaff.associate = (models) => {
    CompanyStaff.belongsTo(models.User, {
      foreignKey: "companyId",
      as: "company",
      onDelete: "CASCADE"
    });
    CompanyStaff.belongsTo(models.User, {
      foreignKey: "staffId",
      as: "staff",
      onDelete: "CASCADE"
    });
    CompanyStaff.belongsTo(models.User, {
      foreignKey: "removedBy",
      as: "removedByUser",
      onDelete: "SET NULL"
    });
    CompanyStaff.belongsTo(models.User, {
      foreignKey: "invitedBy",
      as: "inviter",
      onDelete: "CASCADE"
    });
  };

  return CompanyStaff;
};