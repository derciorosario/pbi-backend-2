'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Creating organization_join_requests table...');

      await queryInterface.createTable('organization_join_requests', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false
        },
        organizationId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: "Organization user ID (accountType='company')"
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: "Individual user ID (accountType='individual') requesting to join"
        },
        status: {
          type: Sequelize.ENUM("pending", "approved", "rejected", "cancelled"),
          allowNull: false,
          defaultValue: "pending"
        },
        requestToken: {
          type: Sequelize.STRING,
          allowNull: false,
          comment: "Token for request management"
        },
        approvedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        rejectedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        cancelledAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        cancelledBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: "User who cancelled the request"
        },
        approvedBy: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id'
          },
          comment: "Organization admin who approved the request"
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: "Optional message from user explaining why they want to join"
        },
        requestedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });

      // Create indexes
      await queryInterface.addIndex('organization_join_requests', ['organizationId', 'userId'], {
        name: 'unique_organization_join_request',
        unique: true,
        where: {
          status: ['pending', 'approved']
        }
      });

      await queryInterface.addIndex('organization_join_requests', ['status'], {
        name: 'idx_organization_join_request_status'
      });

      await queryInterface.addIndex('organization_join_requests', ['requestToken'], {
        name: 'idx_organization_join_request_token'
      });

      await queryInterface.addIndex('organization_join_requests', ['userId'], {
        name: 'idx_organization_join_request_user'
      });

      await queryInterface.addIndex('organization_join_requests', ['organizationId'], {
        name: 'idx_organization_join_request_organization'
      });

      console.log('✅ organization_join_requests table created successfully!');
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error creating organization_join_requests table:', error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('organization_join_requests');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
};