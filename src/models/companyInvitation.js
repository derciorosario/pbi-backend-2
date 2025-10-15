const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const CompanyInvitation = sequelize.define(
    "CompanyInvitation",
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
      invitedUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "User being invited"
      },
      invitationType: {
        type: DataTypes.ENUM("representative", "staff"),
        allowNull: false,
        comment: "Type of invitation"
      },
      role: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: "Staff role if invitationType='staff'"
      },
      status: {
        type: DataTypes.ENUM("sent", "accepted", "declined", "expired", "cancelled"),
        allowNull: false,
        defaultValue: "sent",
      },
      invitationToken: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Token for invitation link"
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        comment: "When the invitation expires"
      },
      acceptedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      declinedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      cancelledBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "User who cancelled the invitation"
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
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Optional personal message with invitation"
      }
    },
    {
      tableName: "company_invitations",
      timestamps: true,
      indexes: [
        {
          fields: ["companyId", "invitedUserId", "invitationType"],
          name: "idx_company_invitation_unique_active",
          unique: true,
          where: {
            status: ["sent"]
          }
        },
        {
          fields: ["status"],
          name: "idx_company_invitation_status"
        },
        {
          fields: ["invitationToken"],
          name: "idx_company_invitation_token"
        },
        {
          fields: ["expiresAt"],
          name: "idx_company_invitation_expires"
        }
      ]
    }
  );

  // Associations
  CompanyInvitation.associate = (models) => {
    CompanyInvitation.belongsTo(models.User, {
      foreignKey: "companyId",
      as: "company",
      onDelete: "CASCADE"
    });
    CompanyInvitation.belongsTo(models.User, {
      foreignKey: "invitedUserId",
      as: "invitedUser",
      onDelete: "CASCADE"
    });
    CompanyInvitation.belongsTo(models.User, {
      foreignKey: "cancelledBy",
      as: "cancelledByUser",
      onDelete: "SET NULL"
    });
    CompanyInvitation.belongsTo(models.User, {
      foreignKey: "invitedBy",
      as: "inviter",
      onDelete: "CASCADE"
    });
  };

  return CompanyInvitation;
};