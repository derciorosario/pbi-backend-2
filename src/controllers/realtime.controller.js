// src/controllers/realtime.controller.js
const { Op } = require("sequelize");
const {
  User,
  Connection,
  ConnectionRequest,
  Conversation,
  Message,
  MeetingRequest,
  Profile
} = require("../models");

/**
 * Initialize socket.io event handlers for the QuickActionsPanel
 * @param {Object} io - The socket.io server instance
 */
exports.initializeQuickActionsEvents = (io) => {
  // Store active socket connections by user ID
  const userSockets = new Map();

  // Middleware to handle socket authentication is already set up in index.js

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    
    // Store the socket connection for this user
    userSockets.set(userId, socket);
    
    console.log(`User ${userId} connected to QuickActions socket`);

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User ${userId} disconnected from QuickActions socket`);
      userSockets.delete(userId);
    });

    // ===== CONNECTION REQUESTS =====
    
    // Get pending connection requests
    socket.on("get_connection_requests", async () => {
      try {
        // Find incoming connection requests
        const incoming = await ConnectionRequest.findAll({
          where: { toUserId: userId, status: "pending" },
          order: [["createdAt", "DESC"]],
          include: [{ 
            model: User, 
            as: "from", 
            attributes: ["id", "name", "email", "avatarUrl"],
            include: [{ 
              model: Profile, 
              as: "profile", 
              attributes: ["professionalTitle"] 
            }]
          }]
        });

        // Format the data
        const formattedRequests = incoming.map(req => ({
          id: req.id,
          fromUser: {
            id: req.from.id,
            name: req.from.name,
            avatarUrl: req.from.avatarUrl,
            title: req.from.profile?.professionalTitle || ""
          },
          reason: req.reason,
          message: req.message,
          createdAt: req.createdAt
        }));

        // Send the connection requests to the client
        socket.emit("connection_requests", formattedRequests);
      } catch (error) {
        console.error("Error fetching connection requests:", error);
        socket.emit("error", { message: "Failed to fetch connection requests" });
      }
    });

    // Respond to a connection request
    socket.on("respond_to_connection", async (data) => {
      try {
        const { requestId, action } = data;
        
        if (!requestId || !action || !["accept", "reject"].includes(action)) {
          return socket.emit("error", { message: "Invalid request data" });
        }

        // Find the connection request
        const request = await ConnectionRequest.findOne({
          where: { id: requestId, toUserId: userId, status: "pending" },
          include: [{ model: User, as: "from", attributes: ["id", "name", "email"] }]
        });

        if (!request) {
          return socket.emit("error", { message: "Connection request not found" });
        }

        // Update the request status
        if (action === "accept") {
          // Normalize the user IDs to ensure consistent connection records
          const userOneId = String(request.fromUserId) < String(userId) ? request.fromUserId : userId;
          const userTwoId = String(request.fromUserId) < String(userId) ? userId : request.fromUserId;
          
          // Create the connection
          await Connection.create({ userOneId, userTwoId });
          
          // Update the request
          request.status = "accepted";
          request.respondedAt = new Date();
          await request.save();
          
          // Notify the requester if they're online
          const requesterSocket = userSockets.get(request.fromUserId);
          if (requesterSocket) {
            requesterSocket.emit("connection_accepted", {
              requestId,
              acceptedBy: {
                id: userId,
                name: socket.user.name
              }
            });
          }
        } else {
          // Reject the request
          request.status = "rejected";
          request.respondedAt = new Date();
          await request.save();
          
          // Notify the requester if they're online
          const requesterSocket = userSockets.get(request.fromUserId);
          if (requesterSocket) {
            requesterSocket.emit("connection_rejected", {
              requestId,
              rejectedBy: {
                id: userId,
                name: socket.user.name
              }
            });
          }
        }

        // Send updated connection requests to the client
        socket.emit("connection_response_success", { requestId, action });
        
        // Trigger a refresh of connection requests
        socket.emit("refresh_connection_requests");
      } catch (error) {
        console.error("Error responding to connection request:", error);
        socket.emit("error", { message: "Failed to respond to connection request" });
      }
    });

    // ===== RECENT CHATS =====
    
    // Get recent conversations
    socket.on("get_recent_chats", async () => {
      try {
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
              attributes: ["id", "name", "avatarUrl"]
            },
            {
              model: User,
              as: "user2",
              attributes: ["id", "name", "avatarUrl"]
            }
          ],
          order: [["lastMessageTime", "DESC"]],
          limit: 5 // Limit to 5 most recent conversations
        });

        // Transform the data to get the other user in each conversation
        const recentChats = conversations.map(conv => {
          const isUser1 = conv.user1Id === userId;
          const otherUser = isUser1 ? conv.user2 : conv.user1;
          const unreadCount = isUser1 ? conv.user1UnreadCount : conv.user2UnreadCount;
          
          // Check if the other user is online
          const isOnline = userSockets.has(otherUser.id);

          return {
            id: conv.id,
            user: {
              id: otherUser.id,
              name: otherUser.name,
              avatarUrl: otherUser.avatarUrl
            },
            lastMessage: conv.lastMessageContent,
            lastMessageTime: conv.lastMessageTime,
            unreadCount,
            online: isOnline
          };
        });

        // Send the recent chats to the client
        socket.emit("recent_chats", recentChats);
      } catch (error) {
        console.error("Error fetching recent chats:", error);
        socket.emit("error", { message: "Failed to fetch recent chats" });
      }
    });

    // ===== UPCOMING MEETINGS =====
    
    // Get upcoming meetings
    socket.on("get_upcoming_meetings", async () => {
      try {
        const now = new Date();
        
        // Find upcoming meetings where the user is either the requester or recipient
        const meetings = await MeetingRequest.findAll({
          where: {
            [Op.or]: [
              { fromUserId: userId },
              { toUserId: userId }
            ],
            status: "accepted",
            scheduledAt: {
              [Op.gte]: now
            }
          },
          include: [
            { model: User, as: "requester", attributes: ["id", "name", "email", "avatarUrl"] },
            { model: User, as: "recipient", attributes: ["id", "name", "email", "avatarUrl"] }
          ],
          order: [["scheduledAt", "ASC"]],
          limit: 5 // Limit to 5 upcoming meetings
        });

        // Format the meetings data
        const upcomingMeetings = meetings.map(meeting => {
          const otherUser = meeting.fromUserId === userId ? meeting.recipient : meeting.requester;
          
          // Calculate if the meeting is today, tomorrow, or later
          const meetingDate = new Date(meeting.scheduledAt);
          const today = new Date();
          const tomorrow = new Date();
          tomorrow.setDate(today.getDate() + 1);
          
          let timeLabel = "";
          if (meetingDate.toDateString() === today.toDateString()) {
            timeLabel = "Today";
          } else if (meetingDate.toDateString() === tomorrow.toDateString()) {
            timeLabel = "Tomorrow";
          } else {
            // Format as "Mon, Jan 1"
            timeLabel = meetingDate.toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric' 
            });
          }
          
          // Format the time (e.g., "3:00 PM")
          const timeString = meetingDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          });

          return {
            id: meeting.id,
            title: meeting.title,
            scheduledAt: meeting.scheduledAt,
            timeLabel,
            timeString,
            duration: meeting.duration,
            mode: meeting.mode,
            link: meeting.link,
            location: meeting.location,
            withUser: {
              id: otherUser.id,
              name: otherUser.name,
              avatarUrl: otherUser.avatarUrl
            }
          };
        });

        // Send the upcoming meetings to the client
        socket.emit("upcoming_meetings", upcomingMeetings);
      } catch (error) {
        console.error("Error fetching upcoming meetings:", error);
        socket.emit("error", { message: "Failed to fetch upcoming meetings" });
      }
    });

    // Join a meeting
    socket.on("join_meeting", async (data) => {
      try {
        const { meetingId } = data;
        
        if (!meetingId) {
          return socket.emit("error", { message: "Meeting ID is required" });
        }

        // Find the meeting
        const meeting = await MeetingRequest.findOne({
          where: {
            id: meetingId,
            status: "accepted",
            [Op.or]: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          }
        });

        if (!meeting) {
          return socket.emit("error", { message: "Meeting not found" });
        }

        // Check if the meeting is a video meeting
        if (meeting.mode !== "video") {
          return socket.emit("error", { message: "Only video meetings can be joined" });
        }

        // Return the meeting link
        socket.emit("meeting_link", {
          meetingId,
          link: meeting.link
        });
      } catch (error) {
        console.error("Error joining meeting:", error);
        socket.emit("error", { message: "Failed to join meeting" });
      }
    });

    // Initialize data on connection
    // Fetch initial data for the QuickActionsPanel
    socket.emit("get_connection_requests");
    socket.emit("get_recent_chats");
    socket.emit("get_upcoming_meetings");
  });
};