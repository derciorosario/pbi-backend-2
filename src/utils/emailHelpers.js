/**
 * Helper functions for email templates
 */

/**
 * Format a date for display in emails
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date (e.g., "Monday, January 1, 2023")
 */
function formatDate(date) {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format a time for display in emails
 * @param {string|Date} date - Date to extract time from
 * @returns {string} Formatted time (e.g., "3:30 PM")
 */
function formatTime(date) {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Register Handlebars helpers for email templates
 * @param {object} helpers - Helpers object from nodemailer-express-handlebars
 */
function registerEmailHelpers(helpers) {
  helpers.formatDate = formatDate;
  helpers.formatTime = formatTime;
}

module.exports = {
  formatDate,
  formatTime,
  registerEmailHelpers
};