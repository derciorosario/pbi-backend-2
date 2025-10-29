// src/models/adminSettings.js
module.exports = (sequelize, DataTypes) => {
  const AdminSettings = sequelize.define('AdminSettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    newPostNotificationSettings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        enabled: true,
        audienceType: 'all', // 'all', 'connections', 'newUsers', 'matchingInterests'
        audienceOptions: ['all'], // array of selected options
        excludeCreator: true,
        emailSubject: 'New {{postType}} posted by {{authorName}} on 54Links',
        emailTemplate: 'new-post'
      },
      comment: 'Settings for new post notifications sent to users'
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
  }, {
    timestamps: true,
    tableName: 'admin_settings',
  });

  return AdminSettings;
};