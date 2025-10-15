// src/routes/message.routes.js
const express = require("express");
const router = express.Router();
const messageController = require("../controllers/message.controller");
const auth = require("../middleware/auth");
const upload = require("../utils/multerConfigAttachments");

// Get all conversations for the current user
router.get("/conversations", auth(), messageController.getConversations);

// Get messages for a specific conversation
router.get("/conversations/:conversationId/messages", auth(), messageController.getMessages);

// Get messages with a specific user (creates conversation if it doesn't exist)
router.get("/users/:userId/messages", auth(), messageController.getMessagesWithUser);

// Send a message to a user
router.post("/users/:userId/messages", auth(), upload.array('attachments', 10), messageController.sendMessage);

// Mark messages as read
router.put("/conversations/:conversationId/read", auth(), messageController.markAsRead);

// Get total unread message count
router.get("/unread-count", auth(), messageController.getUnreadCount);

module.exports = router;