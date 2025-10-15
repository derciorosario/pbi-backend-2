'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'picture', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Base64 encoded profile picture for individual users'
    });

    await queryInterface.addColumn('users', 'birthDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Birth date for individual users'
    });

    await queryInterface.addColumn('users', 'gender', {
      type: Sequelize.ENUM("male", "female", "other", "prefer-not-to-say"),
      allowNull: true,
      comment: 'Gender for individual users'
    });

    await queryInterface.addColumn('users', 'logo', {
      type: Sequelize.TEXT('long'),
      allowNull: true,
      comment: 'Base64 encoded company logo for company users'
    });

    await queryInterface.addColumn('users', 'otherCountries', {
      type: Sequelize.JSON,
      allowNull: true,
      comment: 'Array of countries where company has branches'
    });

    await queryInterface.addColumn('users', 'webpage', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Company website URL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'picture');
    await queryInterface.removeColumn('users', 'birthDate');
    await queryInterface.removeColumn('users', 'gender');
    await queryInterface.removeColumn('users', 'logo');
    await queryInterface.removeColumn('users', 'otherCountries');
    await queryInterface.removeColumn('users', 'webpage');
  }
};