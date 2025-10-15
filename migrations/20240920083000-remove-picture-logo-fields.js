'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if columns exist before trying to remove them
    const tableDescription = await queryInterface.describeTable('users');

    if (tableDescription.picture) {
      await queryInterface.removeColumn('users', 'picture');
    }

    if (tableDescription.logo) {
      await queryInterface.removeColumn('users', 'logo');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Add back the old fields
    await queryInterface.addColumn('users', 'picture', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Base64 encoded profile picture for individual users'
    });

    await queryInterface.addColumn('users', 'logo', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Base64 encoded company logo for company users'
    });
  }
};