// src/controllers/message.controller.js
const { Op } = require("sequelize");
const { Message, Conversation, User, Profile } = require("../models");
const { sendTemplatedEmail } = require("../utils/email");
const { isEmailNotificationEnabled } = require("../utils/notificationSettings");

// Get all conversations for the current user
async function getConversations(req, res, next) {
  try {
    const userId = req.user.sub;

    // Find all conversations where the user is either user1 or user2
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: [
        {
          model: User,
          as: "user1",
          attributes: ["id", "name", "avatarUrl"],
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["professionalTitle"]
            }
          ]
        },
        {
          model: User,
          as: "user2",
          attributes: ["id", "name", "avatarUrl"],
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["professionalTitle"]
            }
          ]
        }
      ],
      order: [["lastMessageTime", "DESC"]]
    });

    // Transform the data to get the other user in each conversation
    const result = conversations.map(conv => {
      const isUser1 = conv.user1Id === userId;
      const otherUser = isUser1 ? conv.user2 : conv.user1;
      const unreadCount = isUser1 ? conv.user1UnreadCount : conv.user2UnreadCount;

      return {
        id: conv.id,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          avatarUrl: otherUser.avatarUrl,
          professionalTitle: otherUser.profile?.professionalTitle || null
        },
        lastMessage: conv.lastMessageContent,
        lastMessageTime: conv.lastMessageTime,
        unreadCount
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// Get messages for a specific conversation
async function getMessages(req, res, next) {
  try {
    const userId = req.user.sub;
    const { conversationId } = req.params;
    const { limit = 50, before } = req.query;

    // Verify the user is part of this conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Build query conditions
    const queryOptions = {
      where: { conversationId },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "avatarUrl"]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10)
    };

    // Add pagination if 'before' timestamp is provided
    if (before) {
      queryOptions.where.createdAt = { [Op.lt]: new Date(before) };
    }

    const messages = await Message.findAll(queryOptions);

    // Mark messages as read if the user is the receiver
    await Message.update(
      { read: true },
      {
        where: {
          conversationId,
          receiverId: userId,
          read: false
        }
      }
    );

    // Reset unread count
    if (conversation.user1Id === userId) {
      conversation.user1UnreadCount = 0;
    } else {
      conversation.user2UnreadCount = 0;
    }
    await conversation.save();

    res.json(messages.reverse()); // Return in chronological order
  } catch (error) {
    next(error);
  }
}

// Get messages with a specific user
async function getMessagesWithUser(req, res, next) {
  try {
    const userId = req.user.sub;
    const { userId: otherUserId } = req.params;
    const { limit = 50, before } = req.query;

    // Find or create conversation
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { user1Id: userId, user2Id: otherUserId },
          { user1Id: otherUserId, user2Id: userId }
        ]
      }
    });

    if (!conversation) {
      // Check if the other user exists
      const otherUser = await User.findByPk(otherUserId);
      if (!otherUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create a new conversation
      conversation = await Conversation.create({
        user1Id: userId,
        user2Id: otherUserId
      });
    }

    // Build query conditions
    const queryOptions = {
      where: { conversationId: conversation.id },
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "avatarUrl"]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit, 10)
    };

    // Add pagination if 'before' timestamp is provided
    if (before) {
      queryOptions.where.createdAt = { [Op.lt]: new Date(before) };
    }

    const messages = await Message.findAll(queryOptions);

    // Mark messages as read if the user is the receiver
    await Message.update(
      { read: true },
      {
        where: {
          conversationId: conversation.id,
          receiverId: userId,
          read: false
        }
      }
    );

    // Reset unread count
    if (conversation.user1Id === userId) {
      conversation.user1UnreadCount = 0;
    } else {
      conversation.user2UnreadCount = 0;
    }
    await conversation.save();

    res.json({
      conversation: {
        id: conversation.id,
        otherUser: {
          id: otherUserId
        }
      },
      messages: messages.reverse() // Return in chronological order
    });
  } catch (error) {
    next(error);
  }
}

// Send a message to a user
async function sendMessage(req, res, next) {
  try {
    const senderId = req.user.sub;
    const { userId: receiverId } = req.params;
    const { content } = req.body;

    // Handle attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      attachments = req.files.map(file => ({
        filename: file.originalname,
        url: `${baseUrl}/api/uploads/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size
      }));
    }

    if (!content && attachments.length === 0) {
      return res.status(400).json({ message: "Message content or attachments are required" });
    }

    // Check if receiver exists
    const receiver = await User.findByPk(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      where: {
        [Op.or]: [
          { user1Id: senderId, user2Id: receiverId },
          { user1Id: receiverId, user2Id: senderId }
        ]
      }
    });

    // Build a lastMessage preview: text if provided, otherwise "Attachment(s)"
    const lastMessagePreview = content && content.trim().length > 0
      ? content
      : (attachments && attachments.length > 0
        ? (attachments.length === 1 ? "Attachment" : `${attachments.length} attachments`)
        : "");

    if (!conversation) {
      conversation = await Conversation.create({
        user1Id: senderId,
        user2Id: receiverId,
        lastMessageContent: lastMessagePreview,
        lastMessageTime: new Date(),
        user1UnreadCount: senderId === receiverId ? 1 : 0,
        user2UnreadCount: receiverId === senderId ? 0 : 1
      });
    } else {
      // Update conversation with last message
      conversation.lastMessageContent = lastMessagePreview;
      conversation.lastMessageTime = new Date();
      
      // Increment unread count for receiver
      if (conversation.user1Id === receiverId) {
        conversation.user1UnreadCount += 1;
      } else {
        conversation.user2UnreadCount += 1;
      }
      
      await conversation.save();
    }

    // Create message
    const message = await Message.create({
      senderId,
      receiverId,
      content,
      conversationId: conversation.id,
      attachments
    });
    console.log('2')

    // Include sender info in response
    const messageWithSender = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: "sender",
          attributes: ["id", "name", "avatarUrl"]
        }
      ]
    });

    // Send email notification to receiver if enabled
    try {
      // Check if receiver has enabled email notifications for messages
      const isEnabled = await isEmailNotificationEnabled(receiverId, 'messages');

   
      if (isEnabled) {
        const sender = await User.findByPk(senderId, { attributes: ["id", "name", "email"] });
        const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
        const messagesLink = `${baseUrl}/messages?userId=${sender.id}`;

        await sendTemplatedEmail({
          to: receiver.email,
          subject: `New Message from ${sender.name}`,
          template: "new-message",
          context: {
            name: receiver.name,
            senderName: sender.name,
            message: content,
            messagesLink
          }
        });
      } else {
        console.log(`Email notification skipped for user ${receiverId} (messages disabled)`);
      }
    } catch (emailErr) {
      console.error("Failed to send message notification email:", emailErr);
      // Continue even if email fails
    }

    res.status(201).json(messageWithSender);
  } catch (error) {
    next(error);
  }
}

// Mark messages as read
async function markAsRead(req, res, next) {
  try {
    const userId = req.user.sub;
    const { conversationId } = req.params;

    // Verify the user is part of this conversation
    const conversation = await Conversation.findOne({
      where: {
        id: conversationId,
        [Op.or]: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Mark messages as read
    await Message.update(
      { read: true },
      {
        where: {
          conversationId,
          receiverId: userId,
          read: false
        }
      }
    );

    // Reset unread count
    if (conversation.user1Id === userId) {
      conversation.user1UnreadCount = 0;
    } else {
      conversation.user2UnreadCount = 0;
    }
    await conversation.save();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

// Get total unread message count
async function getUnreadCount(req, res, next) {
  try {
    const userId = req.user.sub;
    
    // Find all conversations where the user is either user1 or user2
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      }
    });
    
    // Calculate total unread count
    let totalUnread = 0;
    for (const conv of conversations) {
      if (conv.user1Id === userId) {
        totalUnread += conv.user1UnreadCount || 0;
      } else {
        totalUnread += conv.user2UnreadCount || 0;
      }
    }
    
    res.json({ count: totalUnread });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getConversations,
  getMessages,
  getMessagesWithUser,
  sendMessage,
  markAsRead,
  getUnreadCount
};