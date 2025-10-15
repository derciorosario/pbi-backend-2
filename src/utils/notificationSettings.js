// src/utils/notificationSettings.js
const { UserSettings } = require('../models');

/**
 * Check if a user has enabled email notifications for a specific type
 * @param {string} userId - The user ID to check
 * @param {string} notificationType - The type of notification to check
 * @returns {Promise<boolean>} - Whether the user has enabled email notifications for this type
 */
async function isEmailNotificationEnabled(userId, notificationType) {
  try {
    // Get user settings
    const userSettings = await UserSettings.findOne({
      where: { userId }
    });

    // If no settings found, use default (true)
    if (!userSettings) {
      return true;
    }

    // Parse notifications if it's a string
    const notifications = typeof userSettings.notifications === 'string'
      ? JSON.parse(userSettings.notifications)
      : userSettings.notifications;

    // Check if the notification type exists and is enabled for email
    return notifications?.[notificationType]?.email === true;
  } catch (error) {
    console.error(`Error checking notification settings for user ${userId}:`, error);
    // Default to true in case of error to ensure notifications are sent
    return true;
  }
}

module.exports = {
  isEmailNotificationEnabled
};