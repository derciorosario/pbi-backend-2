// src/models/workSample.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const WorkSample = sequelize.define(
    "WorkSample",
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
          model: 'profiles',
          key: 'id'
        }
      },
      title: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      projectUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      imageBase64: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
      imageFileName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      technologies: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      attachments: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
      },
      completionDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      isPublic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    { tableName: "work_samples", timestamps: true }
  );

  return WorkSample;
};