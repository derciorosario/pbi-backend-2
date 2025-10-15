'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add connectionsOnly column
    await queryInterface.addColumn('user_settings', 'connectionsOnly', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether to show only posts from connections'
    });

    // Add contentType column
    await queryInterface.addColumn('user_settings', 'contentType', {
      type: Sequelize.ENUM('all', 'text', 'images'),
      allowNull: false,
      defaultValue: 'all',
      comment: 'Type of content to display: all, text only, or images only'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove contentType column
    await queryInterface.removeColumn('user_settings', 'contentType');

    // Remove connectionsOnly column
    await queryInterface.removeColumn('user_settings', 'connectionsOnly');
  }
};
