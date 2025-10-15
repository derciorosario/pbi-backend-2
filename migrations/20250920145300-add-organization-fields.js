'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Adding organization fields to users table...');

      // Add organizationId column
      await queryInterface.addColumn('users', 'organizationId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Organization this user belongs to (for individual users)"
      });

      // Add organizationRole column
      await queryInterface.addColumn('users', 'organizationRole', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: "Role/position within the organization"
      });

      // Add organizationJoinedAt column
      await queryInterface.addColumn('users', 'organizationJoinedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When user joined the organization"
      });

      console.log('✅ Organization fields added successfully!');
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error adding organization fields:', error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Remove columns in reverse order
      await queryInterface.removeColumn('users', 'organizationJoinedAt');
      await queryInterface.removeColumn('users', 'organizationRole');
      await queryInterface.removeColumn('users', 'organizationId');
      
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
};