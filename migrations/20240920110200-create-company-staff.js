'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('company_staff', {
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
        comment: 'Company where the user works'
      },
      staffId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'User who is staff member'
      },
      role: {
        type: Sequelize.ENUM('employee', 'manager', 'contractor', 'intern', 'consultant'),
        allowNull: false,
        defaultValue: 'employee',
        comment: 'Role of the staff member'
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'removed', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Staff relationship status'
      },
      invitationToken: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        comment: 'Secure token for invitation verification'
      },
      invitedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the invitation was sent'
      },
      invitedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who sent the invitation'
      },
      confirmedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the staff member confirmed'
      },
      rejectedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the staff invitation was rejected'
      },
      removedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the staff member was removed'
      },
      removedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who removed the staff member'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Additional notes about the staff relationship'
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
    await queryInterface.addIndex('company_staff', ['companyId']);
    await queryInterface.addIndex('company_staff', ['staffId']);
    await queryInterface.addIndex('company_staff', ['status']);
    await queryInterface.addIndex('company_staff', ['role']);
    await queryInterface.addIndex('company_staff', ['companyId', 'staffId'], { unique: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('company_staff');
  }
};