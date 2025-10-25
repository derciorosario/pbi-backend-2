const { Support } = require("../models");
const { sendTemplatedEmail } = require("../utils/email");
const upload = require("../utils/multerConfigAllMediaAttachments");

async function submitSupport(req, res, next) {
  try {
    console.log("Support submission received");
    const {
      fullName,
      email,
      phone,
      supportReason,
      priority,
      message,
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !supportReason || !priority || !message) {
      return res.status(400).json({
        message: "Missing required fields: fullName, email, supportReason, priority, message"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Please provide a valid email address"
      });
    }

    // Validate support reason
    const validReasons = ["technical", "account", "data", "general", "other"];
    if (!validReasons.includes(supportReason)) {
      return res.status(400).json({
        message: "Invalid support reason"
      });
    }

    // Validate priority
    const validPriorities = ["low", "medium", "high"];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        message: "Invalid priority"
      });
    }

    // Handle file attachment
    let attachmentData = {};
    if (req.file) {
      attachmentData = {
        attachment: req.savedFileUrl,
        attachmentName: req.file.originalname,
        attachmentType: req.file.mimetype
      };
    }

    // Create support record
    const support = await Support.create({
      fullName,
      email,
      phone,
      supportReason,
      priority,
      message,
      ...attachmentData,
      status: "new"
    });

    // Send email notification to admin
    try {
      const adminEmail = 'derciorosario55@gmail.com'//process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || "updates-noreply@54links.com";

      await sendTemplatedEmail({
        to: adminEmail,
        subject: `New Support Request - ${priority} Priority - ${supportReason}`,
        template: "support-notification",
        context: {
          subject: `New Support Request - ${priority} Priority - ${supportReason}`,
          preheader: `New ${priority} priority ${supportReason} support request from ${fullName}`,
          support: {
            id: support.id,
            fullName,
            email,
            phone,
            supportReason,
            priority,
            message,
            attachment: req.file ? {
              name: req.file.originalname,
              url: req.savedFileUrl,
              type: req.file.mimetype
            } : null,
            submittedAt: support.createdAt
          }
        },
      });
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error("Failed to send support notification email:", emailError);
    }

    console.log("Support request submitted successfully:", support.id);
    res.status(201).json({
      message: "Support request submitted successfully",
      supportId: support.id
    });

  } catch (error) {
    console.error("Support submission error:", error);
    next(error);
  }
}

// Get all supports (admin function)
async function getAllSupports(req, res, next) {
  try {
    const { status, priority, supportReason, limit = 50, offset = 0 } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }
    if (priority) {
      whereClause.priority = priority;
    }
    if (supportReason) {
      whereClause.supportReason = supportReason;
    }

    const supports = await Support.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      supports: supports.rows,
      total: supports.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
}

// Get support by ID (admin function)
async function getSupportById(req, res, next) {
  try {
    const { id } = req.params;

    const support = await Support.findByPk(id);
    if (!support) {
      return res.status(404).json({ message: "Support request not found" });
    }

    res.json({ support });
  } catch (error) {
    next(error);
  }
}

// Update support status (admin function)
async function updateSupportStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ["new", "in_progress", "responded", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be one of: " + validStatuses.join(", ")
      });
    }

    const support = await Support.findByPk(id);
    if (!support) {
      return res.status(404).json({ message: "Support request not found" });
    }

    const updateData = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status === "responded") {
      updateData.respondedAt = new Date();
    }

    await support.update(updateData);

    res.json({
      message: "Support request updated successfully",
      support
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitSupport,
  getAllSupports,
  getSupportById,
  updateSupportStatus,
  upload // Export multer upload middleware
};