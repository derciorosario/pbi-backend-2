'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('galleries', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      profileId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'profiles',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'Profile that owns this gallery item'
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Optional title for the gallery item'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Optional description for the gallery item'
      },
      imageUrl: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'URL to the uploaded image file'
      },
      imageFileName: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Original filename of the uploaded image'
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this gallery item is publicly visible'
      },
      displayOrder: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order for displaying gallery items'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes for better performance
    await queryInterface.addIndex('galleries', ['profileId']);
    await queryInterface.addIndex('galleries', ['isPublic']);
    await queryInterface.addIndex('galleries', ['displayOrder']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('galleries');
  }
};