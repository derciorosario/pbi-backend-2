'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('company_staff', 'isMain', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this is the user's main/primary company"
    });

    // Add index for better query performance
    await queryInterface.addIndex('company_staff', ['staffId', 'isMain'], {
      name: 'idx_company_staff_staff_main'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('company_staff', 'idx_company_staff_staff_main');
    await queryInterface.removeColumn('company_staff', 'isMain');
  }
};