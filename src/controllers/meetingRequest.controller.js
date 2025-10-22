const { MeetingRequest, User, Profile, Notification, MeetingParticipant } = require("../models");
const { Op } = require("sequelize");
const { sendTemplatedEmail } = require("../utils/email");
const { isEmailNotificationEnabled } = require("../utils/notificationSettings");


// Create a new meeting request with participants
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
      link,
      participants = [] // Array of user IDs for additional participants
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

    // Validate participants (remove duplicates and self)
    const uniqueParticipants = [...new Set(participants)]
      .filter(participantId => participantId !== fromUserId && participantId !== toUserId);

    // Check if all participants exist
    if (uniqueParticipants.length > 0) {
      const participantUsers = await User.findAll({
        where: { id: uniqueParticipants },
        attributes: ['id', 'name', 'email']
      });
      
      if (participantUsers.length !== uniqueParticipants.length) {
        return res.status(404).json({ message: "One or more participants not found" });
      }
    }

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

    // Create participant records for additional participants
    const participantRecords = [];
    
    // Add primary recipient as a participant
    participantRecords.push({
      meetingRequestId: meetingRequest.id,
      userId: toUserId,
      status: "pending"
    });

    // Add additional participants
    for (const participantId of uniqueParticipants) {
      participantRecords.push({
        meetingRequestId: meetingRequest.id,
        userId: participantId,
        status: "pending"
      });
    }

    await MeetingParticipant.bulkCreate(participantRecords);

    // Get requester info for notification
    const requester = await User.findByPk(fromUserId, {
      include: [{ model: Profile, as: "profile" }]
    });

    // Notify primary recipient
    await Notification.create({
      userId: toUserId,
      type: "meeting_request",
      title: "New Meeting Request",
      message: `${requester.name || requester.email} has requested a meeting with you: "${title}"`,
      payload: {
        item_id: meetingRequest.id,
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
        hasParticipants: uniqueParticipants.length > 0
      },
    });

    // Notify additional participants
    for (const participantId of uniqueParticipants) {
      await Notification.create({
        userId: participantId,
        type: "meeting_invitation",
        title: "Meeting Invitation",
        message: `${requester.name || requester.email} has invited you to a meeting: "${title}"`,
        payload: {
          item_id: meetingRequest.id,
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
          isParticipant: true
        },
      });
    }

    // Send email notifications
    try {
      // Notify primary recipient
      const isRecipientEnabled = await isEmailNotificationEnabled(toUserId, 'meetingRequests');
      if (isRecipientEnabled) {
        const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
        const meetingLink = `${baseUrl}/notifications?tab=Meetings`;

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
            hasParticipants: uniqueParticipants.length > 0,
            participantCount: uniqueParticipants.length,
            link: meetingLink
          }
        });
      }

      // Notify additional participants
      const participantEmails = await User.findAll({
        where: { id: uniqueParticipants },
        attributes: ['id', 'name', 'email']
      });

      for (const participant of participantEmails) {
        const isEnabled = await isEmailNotificationEnabled(participant.id, 'meetingRequests');
        if (isEnabled) {
          const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
          const meetingLink = `${baseUrl}/notifications?tab=Meetings`;

          await sendTemplatedEmail({
            to: participant.email,
            subject: `Meeting Invitation from ${requester.name || requester.email}`,
            template: "meeting-invitation",
            context: {
              name: participant.name,
              fromName: requester.name || requester.email,
              title,
              agenda: agenda || null,
              scheduledAt: new Date(scheduledAt),
              duration,
              timezone,
              mode,
              location: mode === "in_person" ? location : null,
              link: mode === "video" ? link : null,
              link: meetingLink
            }
          });
        }
      }
    } catch (emailErr) {
      console.error("Failed to send meeting request emails:", emailErr);
      // Continue even if email fails
    }

    // Return the created meeting request with all details
    const result = await MeetingRequest.findByPk(meetingRequest.id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email", "avatarUrl"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email", "avatarUrl"] },
        { 
          model: MeetingParticipant, 
          as: "participants",
          include: [{ 
            model: User, 
            as: "user",  // ← FIX: Added the alias here
            attributes: ["id", "name", "email", "avatarUrl"] 
          }]
        }
      ]
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating meeting request:", error);
    res.status(500).json({ message: "Failed to create meeting request" });
  }
};


// Respond to meeting invitation (for participants)
exports.respondToMeetingInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;
    const userId = req.user.id;

    if (!["accept", "reject", "tentative"].includes(action)) {
      return res.status(400).json({ message: "Action must be 'accept', 'reject', or 'tentative'" });
    }

    // Find the participant record
    const participant = await MeetingParticipant.findOne({
      where: {
        meetingRequestId: id,
        userId: userId
      },
      include: [
        {
          model: MeetingRequest,
          as: 'meetingRequest',
          include: [
            { model: User, as: "requester", attributes: ["id", "name", "email"] }
          ]
        },
        { model: User,as:'user', attributes: ["id", "name", "email"] }
      ]
    });

    if (!participant) {
      return res.status(404).json({ message: "Meeting invitation not found" });
    }

    // Update participant status
    const statusMap = {
      'accept': 'accepted',
      'reject': 'rejected', 
      'tentative': 'tentative'
    };

    await participant.update({
      status: statusMap[action],
      respondedAt: new Date(),
      rejectionReason: action === "reject" ? rejectionReason : null
    });

    // Notify meeting requester
    await Notification.create({
      userId: participant.meetingRequest.fromUserId,
      type: "meeting_participant_response",
      title: "Participant Response",
      message: `${participant.user.name || participant.user.email} ${action}ed your meeting invitation: "${participant.meetingRequest.title}"`,
      payload: {
        item_id: participant.meetingRequest.id,
        participantId: participant.user.id,
        participantName: participant.user.name || participant.user.email,
        action,
        title: participant.meetingRequest.title,
        scheduledAt: participant.meetingRequest.scheduledAt,
        rejectionReason,
        agenda: participant.meetingRequest.agenda,
        duration: parseInt(participant.meetingRequest.duration),
        timezone: participant.meetingRequest.timezone,
        mode: participant.meetingRequest.mode,
        location: participant.meetingRequest.mode === "in_person" ? participant.meetingRequest.location : null,
        link: participant.meetingRequest.mode === "video" ? participant.meetingRequest.link : null
      }
    });

    // Send email notification if enabled
    try {
      // Check if requester has enabled email notifications for meeting requests
      const isEnabled = await isEmailNotificationEnabled(participant.meetingRequest.fromUserId, 'meetingRequests');

      if (isEnabled) {
        const requester = await User.findByPk(participant.meetingRequest.fromUserId, { attributes: ["id", "name", "email"] });
        const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
        const meetingLink = `${baseUrl}/notifications?tab=Meetings`;

        await sendTemplatedEmail({
          to: requester.email,
          subject: `${participant.user.name || participant.user.email} ${action === "accept" ? "Accepted" : action === "reject" ? "Declined" : "Responded to"} Your Meeting Invitation`,
          template: "meeting-response",
          context: {
            name: requester.name,
            responderName: participant.user.name || participant.user.email,
            accepted: action === "accept",
            title: participant.meetingRequest.title,
            scheduledAt: participant.meetingRequest.scheduledAt,
            rejectionReason: action === "reject" ? rejectionReason : null,
            link: meetingLink
          }
        });
      } else {
        console.log(`Email notification skipped for user ${participant.meetingRequest.fromUserId} (meetingRequests disabled)`);
      }
    } catch (emailErr) {
      console.error("Failed to send meeting invitation response email:", emailErr);
      // Continue even if email fails
    }

    res.json(participant);
  } catch (error) {
    console.error("Error responding to meeting invitation:", error);
    res.status(500).json({ message: "Failed to respond to meeting invitation" });
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
        fromUserId:meetingRequest.recipient.id,
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
exports.getMeetingRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get meeting requests where user is primary recipient
    const received = await MeetingRequest.findAll({
      where: { toUserId: userId },
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email", "avatarUrl"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email", "avatarUrl"] },
        { 
          model: MeetingParticipant, 
          as: "participants",
          include: [{ model: User, as: "user", attributes: ["id", "name", "email", "avatarUrl"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Get meeting requests where user is requester
    const sent = await MeetingRequest.findAll({
      where: { fromUserId: userId },
      include: [
        { model: User, as: "recipient", attributes: ["id", "name", "email", "avatarUrl"] },
        { model: User, as: "requester", attributes: ["id", "name", "email", "avatarUrl"] },
        { 
          model: MeetingParticipant, 
          as: "participants",
          include: [{ model: User, as: "user", attributes: ["id", "name", "email", "avatarUrl"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    // Get meeting invitations where user is participant (but not primary recipient)
    const invitations = await MeetingParticipant.findAll({
      where: { 
        userId: userId,
        '$MeetingRequest.toUserId$': { [Op.ne]: userId } // Exclude where user is primary recipient
      },
      include: [
        { 
          model: MeetingRequest,
          as: 'meetingRequest', // Make sure this matches your association alias
          include: [
            { model: User, as: "requester", attributes: ["id", "name", "email", "avatarUrl"] },
            { model: User, as: "recipient", attributes: ["id", "name", "email", "avatarUrl"] },
            { 
              model: MeetingParticipant, 
              as: "participants",
              include: [{ model: User, as: "user", attributes: ["id", "name", "email", "avatarUrl"] }]
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({
      received,
      sent,
      invitations: invitations.map(inv => ({
        ...inv.meetingRequest.toJSON(),
        participantStatus: inv.status,
        participantRespondedAt: inv.respondedAt,
        participantRejectionReason: inv.rejectionReason
      }))
    });
    
  } catch (error) {
    console.error("Error fetching meeting requests:", error);
    res.status(500).json({ message: "Failed to fetch meeting requests" });
  }
};

// Get a specific meeting request
exports.getMeetingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const meetingRequest = await MeetingRequest.findByPk(id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email", "avatarUrl"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email", "avatarUrl"] },
        { 
          model: MeetingParticipant, 
          as: "participants",
          include: [{ model: User, attributes: ["id", "name", "email", "avatarUrl"] }]
        }
      ]
    });

    if (!meetingRequest) {
      return res.status(404).json({ message: "Meeting request not found" });
    }

    // Check if user is involved in this meeting request
    const isRequester = meetingRequest.fromUserId === userId;
    const isRecipient = meetingRequest.toUserId === userId;
    const isParticipant = meetingRequest.participants.some(p => p.userId === userId);
    
    if (!isRequester && !isRecipient && !isParticipant) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(meetingRequest);
  } catch (error) {
    console.error("Error fetching meeting request:", error);
    res.status(500).json({ message: "Failed to fetch meeting request" });
  }
};

// Cancel a meeting request
exports.cancelMeetingRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const meetingRequest = await MeetingRequest.findByPk(id, {
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email"] },
        { 
          model: MeetingParticipant, 
          as: "participants",
          include: [{ model: User, attributes: ["id", "name", "email"] }]
        }
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

    // Get all user IDs to notify (recipient + participants)
    const userIdsToNotify = [
      meetingRequest.toUserId,
      ...meetingRequest.participants.map(p => p.userId)
    ];

    // Create notifications for all involved users
    const notificationPromises = userIdsToNotify.map(userId =>
      Notification.create({
        userId: userId,
        type: "meeting_cancelled",
        title: "Meeting Request Cancelled",
        message: `${meetingRequest.requester.name || meetingRequest.requester.email} cancelled the meeting: "${meetingRequest.title}"`,
        payload: {
          item_id: meetingRequest.id,
          fromUserId: meetingRequest.requester.id,
          meetingRequestId: meetingRequest.id,
          title: meetingRequest.title,
          scheduledAt: meetingRequest.scheduledAt
        }
      })
    );

    await Promise.all(notificationPromises);

    // Send email notifications if enabled
    try {
      const usersToEmail = await User.findAll({
        where: { id: userIdsToNotify },
        attributes: ['id', 'name', 'email']
      });

      for (const user of usersToEmail) {
        const isEnabled = await isEmailNotificationEnabled(user.id, 'meetingRequests');
        if (isEnabled) {
          await sendTemplatedEmail({
            to: user.email,
            subject: `${meetingRequest.requester.name || meetingRequest.requester.email} Cancelled Meeting`,
            template: "meeting-cancelled",
            context: {
              name: user.name,
              requesterName: meetingRequest.requester.name || meetingRequest.requester.email,
              title: meetingRequest.title,
              scheduledAt: meetingRequest.scheduledAt
            }
          });
        }
      }
    } catch (emailErr) {
      console.error("Failed to send meeting cancellation emails:", emailErr);
      // Continue even if email fails
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

    // Get meetings where user is requester, recipient, or participant and meeting is accepted
    const meetings = await MeetingRequest.findAll({
      where: {
        status: "accepted",
        scheduledAt: {
          [Op.gte]: now
        },
        [Op.or]: [
          { fromUserId: userId },
          { toUserId: userId },
          { '$participants.userId$': userId }
        ]
      },
      include: [
        { model: User, as: "requester", attributes: ["id", "name", "email", "avatarUrl"] },
        { model: User, as: "recipient", attributes: ["id", "name", "email", "avatarUrl"] },
        { 
          model: MeetingParticipant, 
          as: "participants",
          include: [{ model: User, attributes: ["id", "name", "email", "avatarUrl"] }]
        }
      ],
      order: [["scheduledAt", "ASC"]]
    });

    res.json(meetings);
  } catch (error) {
    console.error("Error fetching upcoming meetings:", error);
    res.status(500).json({ message: "Failed to fetch upcoming meetings" });
  }
};



// Get meetings for a specific user profile (public endpoint)
exports.getProfileMeetings = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user?.id; // Optional, for filtering

    console.log("Fetching profile meetings for user:", userId);

    // Find all meetings where the profile user is involved
    const meetings = await MeetingRequest.findAll({
      where: {
        status: "accepted",
        [Op.or]: [
          { fromUserId: userId },
          { toUserId: userId },
          { '$participants.userId$': userId }
        ]
      },
      include: [
        { 
          model: User, 
          as: "requester", 
          attributes: ["id", "name", "email", "avatarUrl"] 
        },
        { 
          model: User, 
          as: "recipient", 
          attributes: ["id", "name", "email", "avatarUrl"] 
        },
        { 
          model: MeetingParticipant, 
          as: "participants",
          include: [{ 
            model: User, 
            as: "user", 
            attributes: ["id", "name", "email", "avatarUrl"] 
          }]
        }
      ],
      order: [["scheduledAt", "DESC"]]
    });

    console.log("Found meetings:", meetings.length);

    // If current user is logged in, also include meetings where both users are involved
    let additionalMeetings = [];
    if (currentUserId && currentUserId !== userId) {
      additionalMeetings = await MeetingRequest.findAll({
        where: {
          status: "accepted",
          [Op.or]: [
            { 
              [Op.and]: [
                { fromUserId: currentUserId },
                { '$participants.userId$': userId }
              ]
            },
            { 
              [Op.and]: [
                { toUserId: currentUserId },
                { '$participants.userId$': userId }
              ]
            },
            { 
              [Op.and]: [
                { '$participants.userId$': currentUserId },
                { fromUserId: userId }
              ]
            },
            { 
              [Op.and]: [
                { '$participants.userId$': currentUserId },
                { toUserId: userId }
              ]
            }
          ]
        },
        include: [
          { 
            model: User, 
            as: "requester", 
            attributes: ["id", "name", "email", "avatarUrl"] 
          },
          { 
            model: User, 
            as: "recipient", 
            attributes: ["id", "name", "email", "avatarUrl"] 
          },
          { 
            model: MeetingParticipant, 
            as: "participants",
            include: [{ 
              model: User, 
              as: "user", 
              attributes: ["id", "name", "email", "avatarUrl"] 
            }]
          }
        ],
        order: [["scheduledAt", "DESC"]]
      });

      console.log("Found additional meetings:", additionalMeetings.length);
    }

    // Combine and remove duplicates
    const allMeetings = [...meetings, ...additionalMeetings].filter((meeting, index, array) => 
      array.findIndex(m => m.id === meeting.id) === index
    );

    // Log the participants for debugging
    allMeetings.forEach(meeting => {
      console.log(`Meeting ${meeting.id} - ${meeting.title}:`, {
        requester: meeting.requester?.name,
        recipient: meeting.recipient?.name,
        participantsCount: meeting.participants?.length || 0,
        participants: meeting.participants?.map(p => ({
          id: p.user?.id,
          name: p.user?.name,
          status: p.status
        }))
      });
    });

    res.json(allMeetings);
  } catch (error) {
    console.error("Error fetching profile meetings:", error);
    res.status(500).json({ message: "Failed to fetch profile meetings" });
  }
};