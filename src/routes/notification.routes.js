const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const notificationController = require("../controllers/notification.controller");

// All routes require authentication
router.use(auth);

// Get notifications for current user
router.get("/", notificationController.getNotifications);

// Get unread notification count
router.get("/unread-count", notificationController.getUnreadCount);

// Mark notification as read
router.post("/:id/read", notificationController.markAsRead);

// Mark all notifications as read
router.post("/mark-all-read", notificationController.markAllAsRead);

// Delete notification
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;