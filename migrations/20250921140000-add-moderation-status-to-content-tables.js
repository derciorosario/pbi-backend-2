'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add moderation_status to events table
    await queryInterface.addColumn('events', 'moderation_status', {
      type: Sequelize.ENUM("approved", "reported", "under_review", "removed", "suspended"),
      defaultValue: "approved",
      allowNull: false
    });

    // Add moderation_status to services table
    await queryInterface.addColumn('services', 'moderation_status', {
      type: Sequelize.ENUM("approved", "reported", "under_review", "removed", "suspended"),
      defaultValue: "approved",
      allowNull: false
    });

    // Add moderation_status to products table
    await queryInterface.addColumn('products', 'moderation_status', {
      type: Sequelize.ENUM("approved", "reported", "under_review", "removed", "suspended"),
      defaultValue: "approved",
      allowNull: false
    });

    // Add moderation_status to tourism table
    await queryInterface.addColumn('tourism', 'moderation_status', {
      type: Sequelize.ENUM("approved", "reported", "under_review", "removed", "suspended"),
      defaultValue: "approved",
      allowNull: false
    });

    // Add moderation_status to funding table
    await queryInterface.addColumn('funding', 'moderation_status', {
      type: Sequelize.ENUM("approved", "reported", "under_review", "removed", "suspended"),
      defaultValue: "approved",
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('events', 'moderation_status');
    await queryInterface.removeColumn('services', 'moderation_status');
    await queryInterface.removeColumn('products', 'moderation_status');
    await queryInterface.removeColumn('tourism', 'moderation_status');
    await queryInterface.removeColumn('funding', 'moderation_status');
  }
};