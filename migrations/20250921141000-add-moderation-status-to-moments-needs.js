'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add moderation_status to moments table
    await queryInterface.addColumn('moments', 'moderation_status', {
      type: Sequelize.ENUM("approved", "reported", "under_review", "removed", "suspended"),
      defaultValue: "approved",
      allowNull: false
    });

    // Add moderation_status to needs table
    await queryInterface.addColumn('needs', 'moderation_status', {
      type: Sequelize.ENUM("approved", "reported", "under_review", "removed", "suspended"),
      defaultValue: "approved",
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('moments', 'moderation_status');
    await queryInterface.removeColumn('needs', 'moderation_status');
  }
};