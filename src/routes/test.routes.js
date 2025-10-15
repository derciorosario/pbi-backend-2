const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { runNotificationEmailsNow, sendNotificationEmails } = require('../cron/notificationEmails');

/**
 * @route POST /api/test/notifications
 * @desc Trigger notification emails for testing
 * @access Private
 */
router.post('/notifications', auth(true), function(req, res) {
  try {
    // Run the notification emails
    runNotificationEmailsNow()
      .then(() => {
        return res.json({ message: 'Notification emails triggered successfully' });
      })
      .catch(error => {
        console.error('Error triggering notification emails:', error);
        return res.status(500).json({ message: 'Failed to trigger notification emails' });
      });
  } catch (error) {
    console.error('Error triggering notification emails:', error);
    return res.status(500).json({ message: 'Failed to trigger notification emails' });
  }
});

/**
 * @route GET /api/test/notifications/daily
 * @desc Trigger daily notification emails for testing (no auth required for testing)
 * @access Public (for testing only)
 */
router.get('/notifications/daily', function(req, res) {
  try {
    // Run daily notification emails
    sendNotificationEmails('daily')
      .then(() => {
        return res.json({ message: 'Daily notification emails triggered successfully' });
      })
      .catch(error => {
        console.error('Error triggering daily notification emails:', error);
        return res.status(500).json({ message: 'Failed to trigger daily notification emails' });
      });
  } catch (error) {
    console.error('Error triggering daily notification emails:', error);
    return res.status(500).json({ message: 'Failed to trigger daily notification emails' });
  }
});

router.get('/notifications/monthly', function(req, res) {
  try {
    // Run daily notification emails
    sendNotificationEmails('monthly')
      .then(() => {
        return res.json({ message: 'Daily notification emails triggered successfully' });
      })
      .catch(error => {
        console.error('Error triggering daily notification emails:', error);
        return res.status(500).json({ message: 'Failed to trigger daily notification emails' });
      });
  } catch (error) {
    console.error('Error triggering daily notification emails:', error);
    return res.status(500).json({ message: 'Failed to trigger daily notification emails' });
  }
});



module.exports = router;