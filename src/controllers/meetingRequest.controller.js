const { MeetingRequest, User, Profile, Notification } = require("../models");
const { Op } = require("sequelize");
const { sendTemplatedEmail } = require("../utils/email");
const { isEmailNotificationEnabled } = require("../utils/notificationSettings");

// Create a new meeting request
exports.createMeetingRequest = async (req, res) => {
  try {
  
    
    const fromUserId = req.user.id;
    const {
      toUserId,
      title,
      agenda,
      scheduledAt,
      duration = 30,
      timezone = "UTC",
      mode = "video",
      location,
      link
    } = req.body;


    // Validate required fields
    if (!toUserId || !title || !scheduledAt) {
      console.log("Validation failed - missing required fields");
      return res.status(400).json({
        message: "Missing required fields: toUserId, title, scheduledAt"
      });
    }

    // Check if recipient exists
    console.log("Checking if recipient exists:", toUserId);
    const recipient = await User.findByPk(toUserId);
    if (!recipient) {
      console.log("Recipient not found");
      return res.status(404).json({ message: "Recipient not found" });
    }
    console.log("Recipient found:", recipient.name);

    // Prevent self-meeting requests
    if (fromUserId === toUserId) {
      return res.status(400).json({ message: "Cannot request meeting with yourself" });
    }

    // Validate mode-specific fields
   /* if (mode === "video" && !link) {
      return res.status(400).json({ message: "Video meetings require a call link" });
    }
    if (mode === "in_person" && !location) {
      return res.status(400).json({ message: "In-person meetings require a location" });
    }
*/
    // Create the meeting request
    console.log("Creating meeting request in database...");
    const meetingRequest = await MeetingRequest.create({
      fromUserId,
      toUserId,
      title,
      agenda,
      scheduledAt: new Date(scheduledAt),
      duration: parseInt(duration),
      timezone,
      mode,
      location: mode === "in_person" ? location : null,
      link: mode === "video" ? link : null,
      status: "pending"
    });
    
    console.log("Meeting request created:", meetingRequest.id);

    // Get requester info for notification
    const requester = await User.findByPk(fromUserId, {
      include: [{ model: Profile, as: "profile" }]
    });

    // Create notification for recipient
    await Notification.create({
      userId: toUserId,
      type: "meeting_request",
      title: "New Meeting Request",
      message: `${requester.name || requester.email} has requested a meeting with you: "${title}"`,
      payload: {
        item_id:meetingRequest.id,
        fromUserId,
        fromName: requester.name || requester.email,
        title,
      agenda,
      scheduledAt: new Date(scheduledAt),
      duration: parseInt(duration),
      timezone,
      mode,
      location: mode === "in_person" ? location : null,
      link: mode === "video" ? link : null,
      },
    });

    // Send email notification if enabled
    try {
      // Check if recipient has enabled email notifications for meeting requests
      const isEnabled = await isEmailNotificationEnabled(toUserId, 'meetingRequests');
      
      if (isEnabled) {
        const recipient = await User.findByPk(toUserId, { attributes: ["id", "name", "email"] });
        const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
        const link = `${baseUrl}/notifications?tab=Meetings`;

        await sendTemplatedEmail({
          to: recipient.email,
          subject: `New Meeting Request from ${requester.name || requester.email}`,
          template: "meeting-request",
          context: {
            name: recipient.name,
            fromName: requester.name || requester.email,
            title,
            agenda: agenda || null,
            scheduledAt: new Date(scheduledAt),
            duration,
            timezone,
            mode,
            location: mode === "in_person" ? location : null,
            link: mode === "video" ? link : null,
            link: link
          }
        });
      } else {
        console.log(`Email notification skipped for user ${toUserId} (meetingRequests disabled)`);
      }
    } catch (emailErr) {
        console.error("Failed to send meeting request email:", emailErr);
        // Continue even if email fails
    }

    // Return the created meeting request with requester info
    const result = await MeetingRequest.findByPk(meetingRequest.id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email"] }
      ]
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating meeting request:", error);
    res.status(500).json({ message: "Failed to create meeting request" });
  }
};

// Get meeting requests for current user (both sent and received)
exports.getMeetingRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get received meeting requests
    const received = await MeetingRequest.findAll({
      where: { toUserId: userId },
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Get sent meeting requests
    const sent = await MeetingRequest.findAll({
      where: { fromUserId: userId },
      include: [
        { model: User, as: "recipient", attributes: ["id", "name", "email"] },
        { model: User, as: "requester", attributes: ["id", "name", "email"] }
        
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({
      received,
      sent
    });
    
  } catch (error) {
    console.error("Error fetching meeting requests:", error);
    res.status(500).json({ message: "Failed to fetch meeting requests" });
  }
};

// Respond to a meeting request (accept/reject)
exports.respondToMeetingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;
    const userId = req.user.id;


    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ message: "Action must be 'accept' or 'reject'" });
    }

    // Find the meeting request
    const meetingRequest = await MeetingRequest.findByPk(id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email"] }
      ]
    });

    if (!meetingRequest) {
      return res.status(404).json({ message: "Meeting request not found" });
    }

    // Check if user is the recipient
    if (meetingRequest.toUserId !== userId) {
      return res.status(403).json({ message: "You can only respond to meeting requests sent to you" });
    }

    // Check if already responded
    if (meetingRequest.status !== "pending") {
      return res.status(400).json({ message: "Meeting request has already been responded to" });
    }

    // Update the meeting request
    await meetingRequest.update({
      status: action === "accept" ? "accepted" : "rejected",
      respondedAt: new Date(),
      rejectionReason: action === "reject" ? rejectionReason : null
    });

    // Create notification for requester
    const notificationMessage = action === "accept"
      ? `${meetingRequest.recipient.name || meetingRequest.recipient.email} accepted your meeting request: "${meetingRequest.title}"`
      : `${meetingRequest.recipient.name || meetingRequest.recipient.email} declined your meeting request: "${meetingRequest.title}"`;

    await Notification.create({
      userId: meetingRequest.fromUserId,
      type: "meeting_response",
      title: action === "accept" ? "Meeting Request Accepted" : "Meeting Request Declined",
      message: notificationMessage,
      payload: {
        item_id:meetingRequest,
        action,
        fromName:meetingRequest.recipient.name,
        title: meetingRequest.title,
        scheduledAt: meetingRequest.scheduledAt,
        rejectionReason,
          agenda:meetingRequest.agenda,
          scheduledAt: new Date(meetingRequest.scheduledAt),
          duration: parseInt(meetingRequest.duration),
          timezone:meetingRequest.timezone,
          mode:meetingRequest.mode,
          location: meetingRequest.mode === "in_person" ? meetingRequest.location : null,
          link: meetingRequest.mode === "video" ? meetingRequest.link : null,
      }
    });

    // Send email notification if enabled
    try {
      // Check if requester has enabled email notifications for meeting requests
      const isEnabled = await isEmailNotificationEnabled(meetingRequest.fromUserId, 'meetingRequests');
      
      if (isEnabled) {
        const requester = await User.findByPk(meetingRequest.fromUserId, { attributes: ["id", "name", "email"] });
        const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
        const profileLink = `${baseUrl}/profile/${meetingRequest.toUserId}`;

        await sendTemplatedEmail({
          to: requester.email,
          subject: action === "accept"
            ? `${meetingRequest.recipient.name || meetingRequest.recipient.email} Accepted Your Meeting Request`
            : `${meetingRequest.recipient.name || meetingRequest.recipient.email} Declined Your Meeting Request`,
          template: "meeting-response",
          context: {
            name: requester.name,
            responderName: meetingRequest.recipient.name || meetingRequest.recipient.email,
            accepted: action === "accept",
            title: meetingRequest.title,
            scheduledAt: meetingRequest.scheduledAt,
            rejectionReason: action === "reject" ? rejectionReason : null,
            profileLink
          }
        });
      } else {
        console.log(`Email notification skipped for user ${meetingRequest.fromUserId} (meetingRequests disabled)`);
      }
    } catch (emailErr) {
      console.error("Failed to send meeting response email:", emailErr);
      // Continue even if email fails
    }

    res.json(meetingRequest);
  } catch (error) {
    console.error("Error responding to meeting request:", error);
    res.status(500).json({ message: "Failed to respond to meeting request" });
  }
};

// Get a specific meeting request
exports.getMeetingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const meetingRequest = await MeetingRequest.findByPk(id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email"] }
      ]
    });

    if (!meetingRequest) {
      return res.status(404).json({ message: "Meeting request not found" });
    }

    // Check if user is involved in this meeting request
    if (meetingRequest.fromUserId !== userId && meetingRequest.toUserId !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(meetingRequest);
  } catch (error) {
    console.error("Error fetching meeting request:", error);
    res.status(500).json({ message: "Failed to fetch meeting request" });
  }
};

// Cancel a meeting request (only by requester)
exports.cancelMeetingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const meetingRequest = await MeetingRequest.findByPk(id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email"] }
      ]
    });

    if (!meetingRequest) {
      return res.status(404).json({ message: "Meeting request not found" });
    }

    // Check if user is the requester
    if (meetingRequest.fromUserId !== userId) {
      return res.status(403).json({ message: "Only the requester can cancel a meeting request" });
    }

    // Update status to cancelled
    await meetingRequest.update({
      status: "cancelled",
      respondedAt: new Date()
    });

    // Create notification for recipient if request was still pending
    if (meetingRequest.status === "pending") {
      await Notification.create({
        userId: meetingRequest.toUserId,
        type: "meeting_cancelled",
        title: "Meeting Request Cancelled",
        message: `${meetingRequest.requester.name || meetingRequest.requester.email} cancelled the meeting request: "${meetingRequest.title}"`,
        payload: {
          item_id: meetingRequest.id,
          meetingRequestId: meetingRequest.id,
          title: meetingRequest.title,
          scheduledAt: meetingRequest.scheduledAt
        }
      });

      // Send email notification if enabled
      try {
        // Check if recipient has enabled email notifications for meeting requests
        const isEnabled = await isEmailNotificationEnabled(meetingRequest.toUserId, 'meetingRequests');
        
        if (isEnabled) {
          const recipient = await User.findByPk(meetingRequest.toUserId, { attributes: ["id", "name", "email"] });

          await sendTemplatedEmail({
            to: recipient.email,
            subject: `${meetingRequest.requester.name || meetingRequest.requester.email} Cancelled Meeting Request`,
            template: "meeting-cancelled",
            context: {
              name: recipient.name,
              requesterName: meetingRequest.requester.name || meetingRequest.requester.email,
              title: meetingRequest.title,
              scheduledAt: meetingRequest.scheduledAt
            }
          });
        } else {
          console.log(`Email notification skipped for user ${meetingRequest.toUserId} (meetingRequests disabled)`);
        }
      } catch (emailErr) {
        console.error("Failed to send meeting cancellation email:", emailErr);
        // Continue even if email fails
      }
    }

    res.json(meetingRequest);
  } catch (error) {
    console.error("Error cancelling meeting request:", error);
    res.status(500).json({ message: "Failed to cancel meeting request" });
  }
};

// Get upcoming accepted meetings for current user
exports.getUpcomingMeetings = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

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
        { model: User, as: "requester", attributes: ["id", "name", "email"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email"] }
      ],
      order: [["scheduledAt", "ASC"]]
    });


    

    res.json(meetings);
  } catch (error) {
    console.error("Error fetching upcoming meetings:", error);
    res.status(500).json({ message: "Failed to fetch upcoming meetings" });
  }
};