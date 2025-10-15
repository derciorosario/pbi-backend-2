const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const OrganizationJoinRequest = sequelize.define(
    "OrganizationJoinRequest",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Organization user ID (accountType='company')"
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Individual user ID (accountType='individual') requesting to join"
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      requestToken: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Token for request management"
      },
      approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rejectedAt: {
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
        comment: "User who cancelled the request"
      },
      approvedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Organization admin who approved the request"
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Optional message from user explaining why they want to join"
      },
      requestedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      tableName: "organization_join_requests",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["organizationId", "userId"],
          name: "unique_organization_join_request",
          where: {
            status: ["pending", "approved"]
          }
        },
        {
          fields: ["status"],
          name: "idx_organization_join_request_status"
        },
        {
          fields: ["requestToken"],
          name: "idx_organization_join_request_token"
        },
        {
          fields: ["userId"],
          name: "idx_organization_join_request_user"
        },
        {
          fields: ["organizationId"],
          name: "idx_organization_join_request_organization"
        }
      ]
    }
  );

  // Associations
  OrganizationJoinRequest.associate = (models) => {
    OrganizationJoinRequest.belongsTo(models.User, {
      foreignKey: "organizationId",
      as: "organization",
      onDelete: "CASCADE"
    });
    OrganizationJoinRequest.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE"
    });
    OrganizationJoinRequest.belongsTo(models.User, {
      foreignKey: "cancelledBy",
      as: "cancelledByUser",
      onDelete: "SET NULL"
    });
    OrganizationJoinRequest.belongsTo(models.User, {
      foreignKey: "approvedBy",
      as: "approvedByUser",
      onDelete: "SET NULL"
    });
  };

  return OrganizationJoinRequest;
};