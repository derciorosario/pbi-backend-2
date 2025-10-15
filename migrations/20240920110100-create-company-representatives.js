'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('company_representatives', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Company being represented'
      },
      representativeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'User authorized as representative'
      },
      status: {
        type: Sequelize.ENUM('pending', 'authorized', 'revoked', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Authorization status'
      },
      authorizationToken: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'Secure token for authorization verification'
      },
      authorizedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the authorization was granted'
      },
      authorizedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who authorized the representative'
      },
      rejectedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the authorization was rejected'
      },
      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the authorization was revoked'
      },
      revokedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who revoked the authorization'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about the representative relationship'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('company_representatives', ['companyId']);
    await queryInterface.addIndex('company_representatives', ['representativeId']);
    await queryInterface.addIndex('company_representatives', ['status']);
    await queryInterface.addIndex('company_representatives', ['companyId', 'representativeId'], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('company_representatives');
  }
};