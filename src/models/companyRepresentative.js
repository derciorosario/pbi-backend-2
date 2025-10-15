const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const CompanyRepresentative = sequelize.define(
    "CompanyRepresentative",
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
      representativeId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Individual user ID (accountType='individual')"
      },
      status: {
        type: DataTypes.ENUM("pending", "authorized", "rejected", "revoked"),
        allowNull: false,
        defaultValue: "pending",
      },
      authorizationToken: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "Token for email authorization link"
      },
      authorizedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      rejectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      revokedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "User who revoked the authorization"
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: "Optional notes about the authorization"
      }
    },
    {
      tableName: "company_representatives",
      timestamps: true,
      indexes: [
        {
          unique: true,
          fields: ["companyId", "representativeId"],
          name: "unique_company_representative"
        },
        {
          fields: ["status"],
          name: "idx_company_representative_status"
        },
        {
          fields: ["authorizationToken"],
          name: "idx_company_representative_token"
        }
      ]
    }
  );

  // Associations
  CompanyRepresentative.associate = (models) => {
    CompanyRepresentative.belongsTo(models.User, {
      foreignKey: "companyId",
      as: "company",
      onDelete: "CASCADE"
    });
    CompanyRepresentative.belongsTo(models.User, {
      foreignKey: "representativeId",
      as: "representative",
      onDelete: "CASCADE"
    });
    CompanyRepresentative.belongsTo(models.User, {
      foreignKey: "revokedBy",
      as: "revokedByUser",
      onDelete: "SET NULL"
    });
  };

  return CompanyRepresentative;
};