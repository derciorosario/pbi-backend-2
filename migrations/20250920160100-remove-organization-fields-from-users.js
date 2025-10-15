'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      console.log('🔄 Removing organization fields from users table...');

      // Remove organization fields from users table
      await queryInterface.removeColumn('users', 'organizationId');
      await queryInterface.removeColumn('users', 'organizationRole');
      await queryInterface.removeColumn('users', 'organizationJoinedAt');

      console.log('✅ Organization fields removed from users table successfully!');
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Error removing organization fields from users table:', error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      // Add back the organization fields if needed to rollback
      await queryInterface.addColumn('users', 'organizationId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        comment: "Organization this user belongs to (for individual users)"
      });

      await queryInterface.addColumn('users', 'organizationRole', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: "Role/position within the organization"
      });

      await queryInterface.addColumn('users', 'organizationJoinedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "When user joined the organization"
      });

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }
};