'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('user_settings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        unique: true
      },
      notifications: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: {
          jobOpportunities: { email: true },
          connectionInvitations: { email: true },
          connectionRecommendations: { email: true },
          connectionUpdates: { email: true },
          messages: { email: true },
          meetingRequests: { email: true },
        },
      },
      emailFrequency: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly', 'auto'),
        allowNull: false,
        defaultValue: 'daily',
      },
      hideMainFeed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether to hide the main feed content'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add index for better performance
    await queryInterface.addIndex('user_settings', ['userId']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('user_settings');
  }
};
