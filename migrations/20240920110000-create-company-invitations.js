'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('company_invitations', {
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
        comment: 'Company that sent the invitation'
      },
      invitedUserId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'User being invited'
      },
      invitationType: {
        type: Sequelize.ENUM('representative', 'staff'),
        allowNull: false,
        comment: 'Type of invitation'
      },
      role: {
        type: Sequelize.ENUM('employee', 'manager', 'contractor', 'intern', 'consultant'),
        allowNull: true,
        comment: 'Staff role (only for staff invitations)'
      },
      status: {
        type: Sequelize.ENUM('sent', 'accepted', 'declined', 'cancelled', 'expired'),
        allowNull: false,
        defaultValue: 'sent',
        comment: 'Current status of the invitation'
      },
      invitationToken: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        comment: 'Secure token for invitation verification'
      },
      sentAt: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.NOW,
        comment: 'When the invitation was sent'
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'When the invitation expires'
      },
      acceptedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the invitation was accepted'
      },
      declinedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the invitation was declined'
      },
      cancelledAt: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the invitation was cancelled'
      },
      cancelledBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who cancelled the invitation'
      },
      invitedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: 'User who sent the invitation'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional personal message with the invitation'
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
    await queryInterface.addIndex('company_invitations', ['companyId']);
    await queryInterface.addIndex('company_invitations', ['invitedUserId']);
    await queryInterface.addIndex('company_invitations', ['invitationToken']);
    await queryInterface.addIndex('company_invitations', ['status']);
    await queryInterface.addIndex('company_invitations', ['expiresAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('company_invitations');
  }
};