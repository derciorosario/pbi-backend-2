'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('messages', 'attachments', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of attachment URLs for images and documents'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('messages', 'attachments');
  }
};