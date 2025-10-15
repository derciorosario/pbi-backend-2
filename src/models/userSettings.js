// src/models/userSettings.js
module.exports = (sequelize, DataTypes) => {
  const UserSettings = sequelize.define('UserSettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users', // <- must match User.tableName exactly
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },
    notifications: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        jobOpportunities: { email: true },
        connectionInvitations: { email: true },
        connectionRecommendations: { email: true },
        connectionUpdates: { email: true },
        messages: { email: true },
        meetingRequests: { email: true },
      },
    },
    emailFrequency: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'auto'),
      allowNull: false,
      defaultValue: 'daily',
    },
    hideMainFeed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether to hide the main feed content'
    },
    connectionsOnly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether to show only posts from connections'
    },
    contentType: {
      type: DataTypes.ENUM('all', 'text', 'images'),
      allowNull: false,
      defaultValue: 'all',
      comment: 'Type of content to display: all, text only, or images only'
    },
    bidirectionalMatch: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether to use bidirectional matching algorithm'
    },
    bidirectionalMatchFormula: {
      type: DataTypes.ENUM('simple', 'reciprocal'),
      allowNull: false,
      defaultValue: 'reciprocal',
      comment: 'Formula to use for bidirectional matching: simple (average) or reciprocal (weighted)'
    },
  }, {
    timestamps: true,
    // optional: freezeTableName: true,
  });

  return UserSettings;
};
