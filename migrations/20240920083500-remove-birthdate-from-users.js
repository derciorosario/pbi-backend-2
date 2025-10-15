'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if birthDate column exists in users table and remove it
    const tableDescription = await queryInterface.describeTable('users');

    if (tableDescription.birthDate) {
      await queryInterface.removeColumn('users', 'birthDate');
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Add birthDate back to users table if needed
    await queryInterface.addColumn('users', 'birthDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Birth date for individual users'
    });
  }
};