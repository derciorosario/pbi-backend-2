require("dotenv").config();
const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const http = require("http");
const socketIo = require("socket.io");
const { Message, Conversation, User, Connection } = require("./src/models");
const { Op } = require("sequelize");
const { authenticate } = require("./src/middleware/auth");
const path = require("path");
const fs = require("fs");

const { sequelize } = require("./src/models");
const authRoutes = require("./src/routes/auth.routes");
const { ensureAdmin } = require("./src/setup/ensureAdmin");
const { initializeQuickActionsEvents } = require("./src/controllers/realtime.controller");
const { startNotificationCronJobs } = require("./src/cron/notificationEmails");

// ---------------------------
// Express App Setup
// ---------------------------
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔒 Security headers
app.use(helmet());

// 🌍 Allow frontend apps to connect
app.use(cors({ origin: true, credentials: true }));

// 📦 Parse JSON bodies
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// 📝 Logging
app.use(morgan("dev"));

// ✅ Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// ⏱️ Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit per IP
});


// --- Response size guard: cap at 10MB and log big payloads ---
const TEN_MB = 40 * 1024 * 1024;
const FIVE_MB = 40 * 1024 * 1024;

app.use((req, res, next) => {
  const _json = res.json.bind(res);
  res.json = (body) => {
    try {
      const str = JSON.stringify(body);            // ⚠️ where OOM usually happens
      const bytes = Buffer.byteLength(str);
      if (bytes >= TEN_MB) {
        console.warn(`[RESPONSE TOO LARGE] ${req.method} ${req.originalUrl} -> ${bytes} bytes`);
        return res.status(413).type("application/json").send(JSON.stringify({
          message: "Response too large (max 10MB)",
        }));
      }
      if (bytes >= FIVE_MB) {
        console.warn(`[LARGE RESPONSE] ${req.method} ${req.originalUrl} -> ${bytes} bytes`);
      }
      return res.type("application/json").send(str);
    } catch (e) {
      console.error("res.json guard error:", e);
      return _json(body); // fallback
    }
  };
  next();
});



app.use("/api/auth", limiter, authRoutes);

const onboardingRoutes = require("./src/routes/onboarding.routes");
app.use("/api/onboarding", onboardingRoutes)

const jobRoutes = require("./src/routes/job.routes");
app.use("/api/jobs", jobRoutes)

const jobApplicationRoutes = require("./src/routes/jobApplication.routes");
app.use("/api/job-applications", jobApplicationRoutes);

const eventRegistrationRoutes = require("./src/routes/eventRegistration.routes");
app.use("/api/event-registrations", eventRegistrationRoutes);

const momentRoutes = require("./src/routes/moment.routes");
app.use("/api/moments", momentRoutes);

app.use("/api/public", require("./src/routes/public.routes"));

app.use("/api/categories", require("./src/routes/category.routes"));

const eventRoutes = require("./src/routes/event.routes");
app.use("/api/events", eventRoutes);

const serviceRoutes = require("./src/routes/service.routes");
app.use("/api/services", serviceRoutes);

const productRoutes = require("./src/routes/product.routes");
app.use("/api/products", productRoutes);

const tourismRoutes = require("./src/routes/tourism.routes");
app.use("/api/tourism", tourismRoutes);

const fundingRoutes = require("./src/routes/funding.routes");
app.use("/api/funding", fundingRoutes);

const needRoutes = require("./src/routes/need.routes");
app.use("/api/needs", needRoutes);

const feedRoutes = require("./src/routes/feed.routes");
app.use("/api", feedRoutes);

// index.js or src/app.js
app.use("/api", require("./src/routes/profile.routes"));
app.use("/api/profile", require("./src/routes/profileApplications.routes"));

const adminRoutes = require("./src/routes/admin.routes");
app.use("/api", adminRoutes);

const peopleRoutes = require("./src/routes/people.routes");
app.use("/api/people", peopleRoutes);

app.use("/api", require("./src/routes/user.routes"));

app.use("/api", require("./src/routes/connection.routes"));

// Message routes
app.use("/api/messages", require("./src/routes/message.routes"));

// Meeting request routes
app.use("/api/meeting-requests", require("./src/routes/meetingRequest.routes"));

// Notification routes
app.use("/api/notifications", require("./src/routes/notification.routes"));

// Settings routes
app.use("/api/user/settings", require("./src/routes/settings.routes"));

const publicRoutes = require("./src/routes/public.routes");

app.use("/api/public", publicRoutes);

// Test routes (for development only)
app.use("/api/test", require("./src/routes/test.routes"));

app.use("/api/general-categories", require("./src/routes/generalCategory.routes"));

app.use("/api/industry-categories", require("./src/routes/industryCategory.routes"));


app.use("/api", require("./src/routes/block.routes"))
app.use("/api", require("./src/routes/report.routes"))
app.use("/api", require("./src/routes/social.routes"))
app.use("/api/admin/moderation", require("./src/routes/moderation.routes"))

// Company management routes
app.use("/api/company", require("./src/routes/company.routes"))

// Organization join request routes
app.use("/api/organization", require("./src/routes/organization.routes"))

// Contact form routes
app.use("/api/contact", require("./src/routes/contact.routes"))

// Support form routes
app.use("/api/support", require("./src/routes/support.routes"))



// Add this route before your 404 handler
app.get('/api/download', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log('Download request for URL:', url);

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Extract filename from URL
    const urlParts = url.split('/');
    let filename = urlParts[urlParts.length - 1];
    
    // Clean up filename - remove query parameters if any
    filename = filename.split('?')[0];
    
    // If filename is invalid, generate a default one
    if (!filename || filename.length > 255 || !filename.includes('.')) {
      const extension = getFileExtensionFromUrl(url);
      filename = `download-${Date.now()}.${extension}`;
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Use axios to proxy the download
    const axios = require('axios');
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000, // 30 second timeout
    });

    // Set content length header if available
    const contentLength = response.headers['content-length'];
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Copy other relevant headers
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }

    console.log(`Starting download: ${filename}, Size: ${contentLength || 'unknown'} bytes`);

    // Pipe the response directly to client
    response.data.pipe(res);

    response.data.on('error', (error) => {
      console.error('Download stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    });

    res.on('finish', () => {
      console.log(`Download completed: ${filename}`);
    });

  } catch (error) {
    console.error('Download controller error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Download failed',
        message: error.message 
      });
    }
  }
});

// Helper function to get file extension from URL
function getFileExtensionFromUrl(url) {
  const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
  return match ? match[1] : 'file';
}


app.get('/api/download/:filename', (req, res) => {
  const fileName = req.params.filename;
  const filePath = path.join(__dirname, './uploads', fileName); 

  if (fs.existsSync(filePath)) {
    const stat = fs.statSync(filePath);

    res.writeHead(200, {
      'Content-Type': 'application/octet-stream', 
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename=${fileName}`,
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } else {
    res.status(404).send('File not found');
  }
})


// ❌ 404 handler
app.use((req, res) => res.status(404).json({ message: "Not found" }));

// ⚠️ Error handler
app.use((err, req, res, next) => {
  console.error(err); // log error
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

// ---------------------------
// Start Server + DB
// ---------------------------
const PORT = process.env.PORT || 5000;

//const { seedIfEmpty } = require("./src/utils/seed");
//const seedAll = require("./src/seeds/seedAll");




(async () => {
  try {
    
    
    await sequelize.authenticate();
    console.log("✅ Database connected");

    //require('./scripts/run-gallery-migration.js')

  //  require('./scripts/create_contacts_table.js')

  //
  
   //require('./scripts/create_meeting_participants_table.js')
   //require('./scripts/create_supports_table.js')


    // Auto-sync DB tables (use migrations in production)
    // Temporarily disabled to avoid schema issues during development
   // await sequelize.sync({ force: false, alter: true });
    
    // 👉 Run seeding if needed
    //await seedIfEmpty();

    // 🔑 Ensure default admin exists
    await ensureAdmin();

    // Create event_registrations table if it doesn't exist
   /* try {
      const { createEventRegistrationsTable } = require('./scripts/create_event_registrations_table');
      await createEventRegistrationsTable();
    } catch (error) {
      console.error("❌ Error creating event_registrations table:", error);
    }

    // Run migration script to add moderation_status column
    try {
      const { addModerationStatusColumn } = require('./scripts/add_moderation_status');
      const migrationResult = await addModerationStatusColumn();
      if (migrationResult) {
        console.log("✅ Migration script executed successfully");
      } else {
        console.error("❌ Migration script failed");
      }
    } catch (error) {
      console.error("❌ Error running migration script:", error);
    }*/

    // Run schema guard to add 'attachments' column to messages if missing
    try {
      const { addAttachmentsColumnToMessages } = require('./scripts/add_attachments_to_messages');
      const ok = await addAttachmentsColumnToMessages();
      if (ok) {
        console.log("✅ Attachments column check complete");
      } else {
        console.error("❌ Attachments column migration failed");
      }
    } catch (error) {
      console.error("❌ Error running attachments column script:", error);
    }

    // Run migration script to create job_applications table
    /*try {
      const { createJobApplicationsTable } = require('./scripts/create_job_applications_table');
      const migrationResult = await createJobApplicationsTable();
      if (migrationResult) {
        console.log("✅ Job applications table migration executed successfully");
      } else {
        console.error("❌ Job applications table migration failed");
      }
    } catch (error) {
      console.error("❌ Error running job applications table migration:", error);
    }*/
    
    // Run migration script to add companyId to jobs table

    /*try {
      const { addCompanyIdToJobs } = require('./scripts/add_companyId_to_jobs');
      const jobsMigrationResult = await addCompanyIdToJobs();
      if (jobsMigrationResult) {
        console.log("✅ CompanyId migration executed successfully");
      } else {
        console.error("❌ CompanyId migration failed");
      }
    } catch (error) {
      console.error("❌ Error running companyId migration:", error);
    }*/



   //require('./scripts/seed.from.singlefile.js')
  // require("./scripts/seedGeneralCategories.js");
   //require("./scripts/seedIndustryCategories.js");

    // Track online users

    //add seeds:
      //node src/seeds/seedUsers.js
    //node node src/seeds/seedProductsServicesTourismFunding.js
  


const { Message, Conversation, User, Connection, Profile, ConnectionRequest, MeetingRequest, Notification  } = require("./src/models");
const { sendTemplatedEmail } = require("./src/utils/email");
const { isEmailNotificationEnabled } = require("./src/utils/notificationSettings");

  

// helper: compute counts for this user
async function getHeaderBadgeCounts(userId) {
  const { Notification } = require("./src/models");

  const [connectionsPending, meetingsPending, messagesPending, jobApplicationsPending, eventRegistrationsPending, companyInvitationsPending] = await Promise.all([
    // Count unread connection notifications (connection.request)
    Notification.count({
      where: {
        userId,
        type: { [Op.like]: 'connection.%' },
        readAt: null
      }
    }),
    // Count unread meeting notifications (meeting_request)
    Notification.count({
      where: {
        userId,
        type: { [Op.like]: 'meeting_%' },
        readAt: null
      }
    }),
    // Count unread message notifications (message.new)
    Notification.count({
      where: {
        userId,
        type: 'message.new',
        readAt: null
      }
    }),
    // Count unread job application notifications (job.application.*)
    Notification.count({
      where: {
        userId,
        type: { [Op.like]: 'job.application.%' },
        readAt: null
      }
    }),
    // Count unread event registration notifications (event.registration.*)
    Notification.count({
      where: {
        userId,
        type: { [Op.like]: 'event.registration.%' },
        readAt: null
      }
    }),
    // Count unread company and organization notifications (company.*, organization.*)
    Notification.count({
      where: {
        userId,
        type: { [Op.or]: [
          { [Op.like]: 'company.%' },
          { [Op.like]: 'organization.%' }
        ]},
        readAt: null
      }
    })
  ]);

  return { connectionsPending, meetingsPending, messagesPending, jobApplicationsPending, eventRegistrationsPending, companyInvitationsPending };
}

// push counts to this socket (or all user sockets if you prefer)
async function pushHeaderCounts(socketOrUserId) {
  const sockets = typeof socketOrUserId === "string"
    ? Array.from(io.sockets.sockets.values()).filter(s => s.userId === socketOrUserId)
    : [socketOrUserId];

  if (!sockets.length) return;

  const userId = typeof socketOrUserId === "string" ? socketOrUserId : socketOrUserId.userId;
  const counts = await getHeaderBadgeCounts(userId);
  sockets.forEach(s => s.emit("header_badge_counts", counts));
}



  const isFn = (v) => typeof v === "function";
  const reply = (socket, maybeAck, fallbackEvent, payload) => {
    if (isFn(maybeAck)) return maybeAck(payload);
    if (fallbackEvent) socket.emit(fallbackEvent, payload);
  };


    // Extract the last-arg ack function (if present)
    const extractAck = (args) => {
      const last = args[args.length - 1];
      return isFn(last) ? last : undefined;
    };

    async function getTotalUnread(userId) {
      const convs = await Conversation.findAll({
        where: { [Op.or]: [{ user1Id: userId }, { user2Id: userId }] },
      });
      return convs.reduce((acc, c) => {
        if (c.user1Id === userId) return acc + (c.user1UnreadCount || 0);
        return acc + (c.user2UnreadCount || 0);
      }, 0);
    }


      // Track online users
    const onlineUsers = new Map();

    // Auth-lite middleware
    io.use(async (socket, next) => {
      try {
        const userId = socket.handshake.auth.userId || socket.handshake.query.userId;
        if (!userId) {
          socket.userId = "anonymous";
          socket.user = { id: "anonymous", name: "Guest" };
          return next();
        }
        socket.userId = userId;

        const user = await User.findByPk(userId);
        socket.user = user ? user : { id: userId, name: "User" };
        next();
      } catch (err) {
        console.error("Error in socket middleware:", err);
        next(err);
      }
    });


    io.on("connection", (socket) => {
      console.log(`User connected: ${socket.userId}`);

      // Register user online (null-safe)
      onlineUsers.set(socket.userId, {
        userId: socket.userId,
        socketId: socket.id,
        user: {
          id: socket.user?.id || socket.userId,
          name: socket.user?.name || "User",
          avatarUrl: socket.user?.avatarUrl || null,
        },
      });

      // Initialize any other real-time modules
      initializeQuickActionsEvents(io);

      // Broadcast online status
      io.emit("user_status_change", { userId: socket.userId, status: "online" });

      // Personal room
      socket.join(socket.userId);

      // -----------------------------
      // Socket-only Messaging API
      // -----------------------------


      // request current counts (ack preferred; fallback event also sent)
      socket.on("get_header_badge_counts", async (ack) => {
        try {
          const counts = await getHeaderBadgeCounts(socket.userId);
          if (typeof ack === "function") ack(counts);
          socket.emit("header_badge_counts", counts);
        } catch (e) {
          console.error("get_header_badge_counts error:", e);
          if (typeof ack === "function") ack({ connectionsPending: 0, meetingsPending: 0 });
        }
      });

      // mark seen/reset on the client UI (no DB mutation needed)
      socket.on("mark_header_badge_seen", (payload, ack) => {
        // You can optionally persist a "lastSeen" timestamp per user if desired.
        if (typeof ack === "function") ack({ ok: true });
      });

      // --- QuickActions: pending connection requests (incoming+outgoing) ---
      socket.on("qa_fetch_connection_requests", async (...args) => {
        const ack = extractAck(args);
        try {
          const userId = socket.userId;

          const incomingRows = await ConnectionRequest.findAll({
            where: { toUserId: userId, status: "pending" },
            order: [["createdAt", "DESC"]],
            include: [{ model: User, as: "from", attributes: ["id", "name", "avatarUrl", "email"] }],
          });

          const outgoingRows = await ConnectionRequest.findAll({
            where: { fromUserId: userId, status: "pending" },
            order: [["createdAt", "DESC"]],
            include: [{ model: User, as: "to", attributes: ["id", "name", "avatarUrl", "email"] }],
          });

          const incoming = incomingRows.map((r) => ({
            id: r.id,
            fromUserId: r.fromUserId,
            fromName: r.from?.name,
            reason: r.reason,
            message: r.message,
            createdAt: r.createdAt,
            from: r.from ? { id: r.from.id, name: r.from.name, avatarUrl: r.from.avatarUrl } : null,
          }));

          const outgoing = outgoingRows.map((r) => ({
            id: r.id,
            toUserId: r.toUserId,
            toName: r.to?.name,
            reason: r.reason,
            message: r.message,
            createdAt: r.createdAt,
            to: r.to ? { id: r.to.id, name: r.to.name, avatarUrl: r.to.avatarUrl } : null,
          }));

          reply(socket, ack, "qa_fetch_connection_requests_result", { ok: true, data: { incoming, outgoing } });
        } catch (e) {
          console.error("qa_fetch_connection_requests error:", e);
          reply(socket, ack, "qa_fetch_connection_requests_result", { ok: false, error: "Failed to load connection requests" });
        }
      });

      // --- QuickActions: respond to a connection request (accept/reject) ---
      socket.on("qa_respond_connection_request", async (...args) => {
        const ack = extractAck(args);
        const payload = args[0] && typeof args[0] === "object" ? args[0] : {};
        const { requestId, action } = payload || {};
        try {
          const userId = socket.userId;
          const req = await ConnectionRequest.findOne({
            where: { id: requestId, toUserId: userId, status: "pending" },
          });
          if (!req) {
            return reply(socket, ack, "qa_respond_connection_request_result", { ok: false, error: "Request not found" });
          }

          if (action === "accept") {
            req.status = "accepted";
            await req.save();
            // (optional) create connection row if your app uses it
            try {
              await Connection.findOrCreate({
                where: {
                  [Op.or]: [
                    { userOneId: req.fromUserId, userTwoId: req.toUserId },
                    { userOneId: req.toUserId, userTwoId: req.fromUserId },
                  ],
                },
                defaults: { userOneId: req.fromUserId, userTwoId: req.toUserId },
              });
            } catch (e) {
              console.warn("Connection create skipped:", e?.message || e);
            }
          } else {
            req.status = "rejected";
            await req.save();
          }

          reply(socket, ack, "qa_respond_connection_request_result", { ok: true });
        } catch (e) {
          console.error("qa_respond_connection_request error:", e);
          reply(socket, ack, "qa_respond_connection_request_result", { ok: false, error: "Failed to respond" });
        }
      });

      // --- QuickActions: recent chats (conversations) ---
      socket.on("qa_fetch_recent_chats", async (...args) => {
        const ack = extractAck(args);
        try {
          const userId = socket.userId;
          const conversations = await Conversation.findAll({
            where: { [Op.or]: [{ user1Id: userId }, { user2Id: userId }] },
            include: [
              {
                model: User,
                as: "user1",
                attributes: ["id", "name", "avatarUrl"],
                include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }],
              },
              {
                model: User,
                as: "user2",
                attributes: ["id", "name", "avatarUrl"],
                include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }],
              },
            ],
            order: [["lastMessageTime", "DESC"]],
          });

          const list = conversations.map((conv) => {
            const isUser1 = conv.user1Id === userId;
            const other = isUser1 ? conv.user2 : conv.user1;
            const unread = isUser1 ? conv.user1UnreadCount : conv.user2UnreadCount;
            return {
              id: conv.id,
              otherUser: {
                id: other?.id,
                name: other?.name || "User",
                avatarUrl: other?.avatarUrl || null,
                professionalTitle: other?.profile?.professionalTitle || null,
              },
              lastMessage: conv.lastMessageContent,
              lastMessageTime: conv.lastMessageTime,
              unreadCount: unread || 0,
            };
          });

          reply(socket, ack, "qa_fetch_recent_chats_result", { ok: true, data: list });
        } catch (e) {
          console.error("qa_fetch_recent_chats error:", e);
          reply(socket, ack, "qa_fetch_recent_chats_result", { ok: false, error: "Failed to load chats" });
        }
      });

      // --- QuickActions: upcoming meetings ---
      socket.on("qa_fetch_upcoming_meetings", async (...args) => {
        const ack = extractAck(args);
        try {
          const userId = socket.userId;
          const now = new Date();

          const rows = await MeetingRequest.findAll({
            where: {
              [Op.or]: [{ fromUserId: userId }, { toUserId: userId }],
              status: "accepted",
              scheduledAt: { [Op.gte]: now },
            },
            include: [
              { model: User, as: "requester", attributes: ["id", "name", "email"] },
              { model: User, as: "recipient", attributes: ["id", "name", "email"] },
            ],
            order: [["scheduledAt", "ASC"]],
          });

          const data = rows.map((m) => ({
            id: m.id,
            title: m.title,
            mode: m.mode,
            link: m.link || null,
            location: m.location || null,
            scheduledAt: m.scheduledAt,
            fromUserId: m.fromUserId,
            toUserId: m.toUserId,
            requester: m.requester ? { id: m.requester.id, name: m.requester.name } : null,
            recipient: m.recipient ? { id: m.recipient.id, name: m.recipient.name } : null,
          }));

          reply(socket, ack, "qa_fetch_upcoming_meetings_result", { ok: true, data });
        } catch (e) {
          console.error("qa_fetch_upcoming_meetings error:", e);
          reply(socket, ack, "qa_fetch_upcoming_meetings_result", { ok: false, error: "Failed to load meetings" });
        }
      });



      // fetch_conversations: supports ack or fire-and-forget (emits 'fetch_conversations_result')
      socket.on("fetch_conversations", async (...args) => {
        const ack = extractAck(args);
        try {
          const userId = socket.userId;
          const conversations = await Conversation.findAll({
            where: { [Op.or]: [{ user1Id: userId }, { user2Id: userId }] },
            include: [
              {
                model: User,
                as: "user1",
                attributes: ["id", "name", "avatarUrl"],
                include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }],
              },
              {
                model: User,
                as: "user2",
                attributes: ["id", "name", "avatarUrl"],
                include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }],
              },
            ],
            order: [["lastMessageTime", "DESC"]],
          });

          const list = conversations.map((conv) => {
            const isUser1 = conv.user1Id === userId;
            const other = isUser1 ? conv.user2 : conv.user1;
            const unread = isUser1 ? conv.user1UnreadCount : conv.user2UnreadCount;
            return {
              id: conv.id,
              otherUser: {
                id: other?.id,
                name: other?.name || "User",
                avatarUrl: other?.avatarUrl || null,
                professionalTitle: other?.profile?.professionalTitle || null,
              },
              lastMessage: conv.lastMessageContent,
              lastMessageTime: conv.lastMessageTime,
              unreadCount: unread || 0,
            };
          });

          reply(socket, ack, "fetch_conversations_result", { ok: true, data: list });
        } catch (e) {
          console.error("fetch_conversations error:", e);
          reply(socket, ack, "fetch_conversations_result", { ok: false, error: "Failed to fetch conversations" });
        }
      });

      // fetch_messages
      socket.on("fetch_messages", async (...args) => {
        const ack = extractAck(args);
        const payload = args[0] && !isFn(args[0]) ? args[0] : {};
        const { conversationId, limit = 50, before } = payload || {};

        try {
          const userId = socket.userId;
          const conversation = await Conversation.findOne({
            where: { id: conversationId, [Op.or]: [{ user1Id: userId }, { user2Id: userId }] },
          });
          if (!conversation) {
            return reply(socket, ack, "fetch_messages_result", { ok: false, error: "Conversation not found" });
          }

          const where = { conversationId };
          if (before) where.createdAt = { [Op.lt]: new Date(before) };

          const rows = await Message.findAll({
            where,
            include: [{ model: User, as: "sender", attributes: ["id", "name", "avatarUrl"] }],
            order: [["createdAt", "DESC"]],
            limit: parseInt(limit, 10),
          });

          await Message.update(
            { read: true },
            { where: { conversationId, receiverId: userId, read: false } }
          );

          if (conversation.user1Id === userId) {
            conversation.user1UnreadCount = 0;
          } else {
            conversation.user2UnreadCount = 0;
          }
          await conversation.save();

          reply(socket, ack, "fetch_messages_result", { ok: true, data: rows.reverse() });

          socket.emit("unread_count_update", { count: await getTotalUnread(userId) });
        } catch (e) {
          console.error("fetch_messages error:", e);
          reply(socket, ack, "fetch_messages_result", { ok: false, error: "Failed to fetch messages" });
        }
      });

      // open_conversation_with_user
      socket.on("open_conversation_with_user", async (...args) => {
        const ack = extractAck(args);
        const payload = args[0] && !isFn(args[0]) ? args[0] : {};
        const { otherUserId, limit = 50 } = payload || {};

        try {
          const userId = socket.userId;

          let conversation = await Conversation.findOne({
            where: {
              [Op.or]: [
                { user1Id: userId, user2Id: otherUserId },
                { user1Id: otherUserId, user2Id: userId },
              ],
            },
          });

          if (!conversation) {
            const other = await User.findByPk(otherUserId);
            if (!other) {
              return reply(socket, ack, "open_conversation_with_user_result", { ok: false, error: "User not found" });
            }
            conversation = await Conversation.create({ user1Id: userId, user2Id: otherUserId });
          }

          const rows = await Message.findAll({
            where: { conversationId: conversation.id },
            include: [{ model: User, as: "sender", attributes: ["id", "name", "avatarUrl"] }],
            order: [["createdAt", "DESC"]],
            limit: parseInt(limit, 10),
          });

          await Message.update(
            { read: true },
            { where: { conversationId: conversation.id, receiverId: userId, read: false } }
          );

          if (conversation.user1Id === userId) {
            conversation.user1UnreadCount = 0;
          } else {
            conversation.user2UnreadCount = 0;
          }
          await conversation.save();

          const other = await User.findByPk(otherUserId, {
            attributes: ["id", "name", "avatarUrl"],
            include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }],
          });

          reply(socket, ack, "open_conversation_with_user_result", {
            ok: true,
            data: {
              conversation: {
                id: conversation.id,
                otherUser: {
                  id: other?.id,
                  name: other?.name || "User",
                  avatarUrl: other?.avatarUrl || null,
                  professionalTitle: other?.profile?.professionalTitle || null,
                },
              },
              messages: rows.reverse(),
            },
          });

          socket.emit("unread_count_update", { count: await getTotalUnread(userId) });
        } catch (e) {
          console.error("open_conversation_with_user error:", e);
          reply(socket, ack, "open_conversation_with_user_result", { ok: false, error: "Failed to open conversation" });
        }
      });

      // search_users
      socket.on("search_users", async (...args) => {
        const ack = extractAck(args);
        const payload = args[0] && !isFn(args[0]) ? args[0] : {};
        const { q, limit = 20 } = payload || {};

        try {
          if (!q || String(q).trim().length < 3) {
            return reply(socket, ack, "search_users_result", { ok: true, data: [] });
          }

          const users = await User.findAll({
            where: { name: { [Op.like]: `%${String(q).trim()}%` } },
            attributes: ["id", "name", "avatarUrl"],
            include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }],
            limit,
          });

          const data = users.map((u) => ({
            id: u.id,
            name: u.name,
            avatarUrl: u.avatarUrl || null,
            professionalTitle: u.profile?.professionalTitle || null,
          }));

          reply(socket, ack, "search_users_result", { ok: true, data });
        } catch (e) {
          console.error("search_users error:", e);
          reply(socket, ack, "search_users_result", { ok: false, error: "Failed to search users" });
        }
      });

      // get_unread_count
      socket.on("get_unread_count", async (...args) => {
        const ack = extractAck(args);
        try {
          const userId = socket.userId;
          const count = await getTotalUnread(userId);
          reply(socket, ack, "get_unread_count_result", { ok: true, data: { count } });
        } catch (e) {
          console.error("get_unread_count error:", e);
          reply(socket, ack, "get_unread_count_result", { ok: false, error: "Failed to get unread count" });
        }
      });

      // mark_read
      socket.on("mark_read", async (...args) => {

        const ack = extractAck(args);
        const payload = args[0] && !isFn(args[0]) ? args[0] : {};
        const { conversationId } = payload || {};

        try {
          const userId = socket.userId;

          const conversation = await Conversation.findByPk(conversationId);
          if (!conversation) {
            return reply(socket, ack, "mark_read_result", { ok: false, error: "Conversation not found" });
          }
          let markedCount = 0;
          if (conversation.user1Id === userId) {
            markedCount = conversation.user1UnreadCount || 0;
            conversation.user1UnreadCount = 0;
          } else if (conversation.user2Id === userId) {
            markedCount = conversation.user2UnreadCount || 0;
            conversation.user2UnreadCount = 0;
          }
          await conversation.save();

          await Message.update(
            { read: true },
            { where: { conversationId, receiverId: userId, read: false } }
          );

          reply(socket, ack, "mark_read_result", { ok: true, data: { conversationId, markedCount } });

          socket.emit("unread_count_update", { count: await getTotalUnread(userId) });
        } catch (error) {
          console.error("mark_read error:", error);
          reply(socket, ack, "mark_read_result", { ok: false, error: "Failed to mark messages as read" });
        }
      });

      // private_message
      socket.on("private_message", async (...args) => {
        const ack = extractAck(args);
        const payload = args[0] && !isFn(args[0]) ? args[0] : {};
        const { receiverId, content } = payload || {};

        try {
          if (!receiverId || !content) {
            return reply(socket, ack, "private_message_result", { ok: false, error: "Invalid message data" });
          }

          let conversation = await Conversation.findOne({
            where: {
              [Op.or]: [
                { user1Id: socket.userId, user2Id: receiverId },
                { user1Id: receiverId, user2Id: socket.userId },
              ],
            },
          });

          if (!conversation) {
            conversation = await Conversation.create({
              user1Id: socket.userId,
              user2Id: receiverId,
              lastMessageContent: content,
              lastMessageTime: new Date(),
              user1UnreadCount: 0,
              user2UnreadCount: 1,
            });
          } else {
            conversation.lastMessageContent = content;
            conversation.lastMessageTime = new Date();
            if (conversation.user1Id === receiverId) {
              conversation.user1UnreadCount += 1;
            } else {
              conversation.user2UnreadCount += 1;
            }
            await conversation.save();
          }

          const message = await Message.create({
            senderId: socket.userId,
            receiverId,
            content,
            conversationId: conversation.id,
          });


          const msgPayload = {
            id: message.id,
            content: message.content,
            senderId: message.senderId,
            receiverId: message.receiverId,
            conversationId: conversation.id,
            createdAt: message.createdAt,
            read: false,
            sender: {
              id: socket.user?.id || socket.userId,
              name: socket.user?.name || "User",
              avatarUrl: socket.user?.avatarUrl || null,
            },
          };

          // broadcast for simplicity (client filters)
          io.emit("private_message", { message: msgPayload });

          // Send email notification to receiver if enabled
          try {
            const receiver = await User.findByPk(receiverId, { attributes: ["id", "name", "email"] });
            const isEnabled = await isEmailNotificationEnabled(receiverId, 'messages');

            if (isEnabled && receiver && 0==1) {
              const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
              const messagesLink = `${baseUrl}/messages?userId=${socket.userId}`;

              await sendTemplatedEmail({
                to: receiver.email,
                subject: `New Message from ${socket.user?.name || "Someone"}`,
                template: "new-message",
                context: {
                  name: receiver.name,
                  senderName: socket.user?.name || "Someone",
                  message: content,
                  messagesLink
                }
              });
            }
          } catch (emailErr) {
            console.error("Failed to send message notification email:", emailErr);
            // Continue even if email fails
          }

          if(0==1){
             // Create in-app notification for receiver
          try {
            await Notification.create({
              userId: receiverId,
              type: "message.new",
              payload: {
                senderId: socket.userId,
                senderName: socket.user?.name || "Someone",
                conversationId: conversation.id,
                messageId: message.id,
                content: content,
                item_id: message.id
              }
            });
          } catch (notifErr) {
            console.error("Failed to create message notification:", notifErr);
            // Continue even if notification creation fails
          }
          }

          reply(socket, ack, "private_message_result", { ok: true, data: { message: msgPayload } });

          // push unread to receiver if connected
          const receiverSocket = Array.from(io.sockets.sockets.values()).find((s) => s.userId === receiverId);
          if (receiverSocket) {
            const totalUnread = await getTotalUnread(receiverId);
            receiverSocket.emit("unread_count_update", { count: totalUnread });
          }
        } catch (e) {
          console.error("private_message error:", e);
          reply(socket, ack, "private_message_result", { ok: false, error: "Failed to send message" });
        }
      });

      // get_online_connections
      socket.on("get_online_connections", async (...args) => {
        const ack = extractAck(args);
        try {
          const connections = await Connection.findAll({
            where: {
              [Op.or]: [{ userOneId: socket.userId }, { userTwoId: socket.userId }],
            },
          });

          const connectedUserIds = connections.map((c) =>
            c.userOneId === socket.userId ? c.userTwoId : c.userOneId
          );

          const list = Array.from(onlineUsers.values()).filter((u) => connectedUserIds.includes(u.userId));

          // respond via ack or the same event name as a fallback payload
          reply(socket, ack, "online_connections", { ok: true, data: list });
        } catch (e) {
          console.error("get_online_connections error:", e);
          reply(socket, ack, "online_connections", { ok: false, error: "Failed to get online connections" });
        }
      });











            // Add to your existing socket.io server code

            // --- Notification-related socket events ---

            // Fetch notifications with pagination and filtering
            socket.on("qa_fetch_notifications", async (...args) => {
              const ack = extractAck(args);
              const payload = args[0] && typeof args[0] === "object" ? args[0] : {};
              const { type, limit = 50, offset = 0 } = payload || {};
              
              try {
                const userId = socket.userId;
                
                const whereClause = { userId };
                if (type && type !== "all") {
                  console.log({type})
                  if (type === "invitation") {
                    // Special case: invitation combines company and organization notifications
                    whereClause.type = {
                      [Op.or]: [
                        { [Op.like]: 'company.%' },
                        { [Op.like]: 'organization.%' }
                      ]
                    };
                  } else if (type === "message") {
                    // Special case: message notifications are exactly "message.new"
                    whereClause.type = 'message.new';
                  } else {
                    whereClause.type = { [Op.like]: `${type}%` };
                  }
                }

                const { count, rows: notifications } = await Notification.findAndCountAll({
                  where: whereClause,
                  order: [["createdAt", "DESC"]],
                  limit: Math.min(parseInt(limit), 100),
                  offset: parseInt(offset),
                  include: [
                    {
                      model: User,
                      as: "user",
                      attributes: ["id", "name", "avatarUrl"]
                    }
                  ]
                });


                reply(socket, ack, "qa_fetch_notifications_result", {
                  ok: true,
                  data: {
                    notifications,
                    pagination: {
                      total: count,
                      limit: parseInt(limit),
                      offset: parseInt(offset),
                      hasMore: (parseInt(offset) + notifications.length) < count
                    }
                  }
                });
              } catch (e) {
                console.error("qa_fetch_notifications error:", e);
                reply(socket, ack, "qa_fetch_notifications_result", {
                  ok: false,
                  error: "Failed to load notifications"
                });
              }
            });

            // Mark notification as read
            socket.on("qa_mark_notification_read", async (...args) => {
              const ack = extractAck(args);
              const payload = args[0] && typeof args[0] === "object" ? args[0] : {};
              const { notificationId } = payload || {};
              
              try {
                const userId = socket.userId;
                
                const notification = await Notification.findByPk(notificationId);
                if (!notification) {
                  return reply(socket, ack, "qa_mark_notification_read_result", {
                    ok: false,
                    error: "Notification not found"
                  });
                }

                if (notification.userId !== userId) {
                  return reply(socket, ack, "qa_mark_notification_read_result", {
                    ok: false,
                    error: "Access denied"
                  });
                }

                await notification.update({ readAt: new Date() });
 
                reply(socket, ack, "qa_mark_notification_read_result", {
                  ok: true,
                  data: { notification }
                });

                // Push updated counts
                pushHeaderCounts(userId);
              } catch (e) {
                console.error("qa_mark_notification_read error:", e);
                reply(socket, ack, "qa_mark_notification_read_result", {
                  ok: false,
                  error: "Failed to mark notification as read"
                });
              }
            });

            // Mark all notifications as read
            socket.on("qa_mark_all_notifications_read", async (...args) => {
              const ack = extractAck(args);
              
              try {
                const userId = socket.userId;
                
                await Notification.update(
                  { readAt: new Date() },
                  { where: { userId, readAt: null } }
                );
                
                reply(socket, ack, "qa_mark_all_notifications_read_result", {
                  ok: true,
                  data: { message: "All notifications marked as read" }
                });

                // Push updated counts
                pushHeaderCounts(userId);
              } catch (e) {
                console.error("qa_mark_all_notifications_read error:", e);
                reply(socket, ack, "qa_mark_all_notifications_read_result", {
                  ok: false,
                  error: "Failed to mark all notifications as read"
                });
              }
            });

            // Delete notification
            socket.on("qa_delete_notification", async (...args) => {
              const ack = extractAck(args);
              const payload = args[0] && typeof args[0] === "object" ? args[0] : {};
              const { notificationId } = payload || {};
              
              try {
                const userId = socket.userId;
                
                const notification = await Notification.findByPk(notificationId);
                if (!notification) {
                  return reply(socket, ack, "qa_delete_notification_result", {
                    ok: false,
                    error: "Notification not found"
                  });
                }

                if (notification.userId !== userId) {
                  return reply(socket, ack, "qa_delete_notification_result", {
                    ok: false,
                    error: "Access denied"
                  });
                }

                await notification.destroy();
                
                reply(socket, ack, "qa_delete_notification_result", {
                  ok: true,
                  data: { message: "Notification deleted" }
                });
              } catch (e) {
                console.error("qa_delete_notification error:", e);
                reply(socket, ack, "qa_delete_notification_result", {
                  ok: false,
                  error: "Failed to delete notification"
                });
              }
            });

            // Get unread notification count
            socket.on("qa_get_notification_counts", async (...args) => {
              const ack = extractAck(args);
              
              try {
                const userId = socket.userId;
                
                const totalUnread = await Notification.count({
                  where: { userId, readAt: null }
                });

                // Count by type for badge breakdown
                const countsByType = await Notification.findAll({
                  where: { userId, readAt: null },
                  attributes: ['type', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                  group: ['type']
                });

                const typeCounts = {};
                countsByType.forEach(item => {
                  typeCounts[item.type] = parseInt(item.get('count'));
                });

                reply(socket, ack, "qa_get_notification_counts_result", {
                  ok: true,
                  data: {
                    totalUnread,
                    byType: typeCounts
                  }
                });
              } catch (e) {
                console.error("qa_get_notification_counts error:", e);
                reply(socket, ack, "qa_get_notification_counts_result", {
                  ok: false,
                  error: "Failed to get notification counts"
                });
              }
            });

            // Real-time notification push
            // This will be called from your controllers when new notifications are created
            function pushNotificationToUser(userId, notification) {
              const userSockets = Array.from(io.sockets.sockets.values())
                .filter(s => s.userId === userId);
              
              userSockets.forEach(socket => {
                socket.emit("new_notification", { notification });
                
                // Also update badge counts
                pushHeaderCounts(userId);
              });
            }

            // Listen for new notifications and push to clients
            socket.on("subscribe_to_notifications", () => {
              // Client is now subscribed to real-time notifications
              console.log(`User ${socket.userId} subscribed to notifications`);
            });









      // Disconnect
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.userId}`);
        onlineUsers.delete(socket.userId);
        io.emit("user_status_change", { userId: socket.userId, status: "offline" });
      });
    });


    
    

    // Start notification cron jobs
    startNotificationCronJobs();


    server.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
})();







