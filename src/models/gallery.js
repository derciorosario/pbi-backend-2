// src/models/gallery.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Gallery = sequelize.define(
    "Gallery",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      profileId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "profiles",
          key: "id",
        },
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imageUrl: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      imageFileName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      isPublic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      displayOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    { tableName: "galleries", timestamps: true }
  );

  Gallery.associate = (models) => {
    Gallery.belongsTo(models.Profile, {
      foreignKey: "profileId",
      as: "profile",
    });
  };

  return Gallery;
};