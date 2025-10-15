const { Contact } = require("../models");
const { sendTemplatedEmail } = require("../utils/email");
const upload = require("../utils/multerConfigAttachments");

async function submitContact(req, res, next) {
  try {
    const {
      fullName,
      email,
      phone,
      contactReason,
      message,
      companyName,
      website
    } = req.body;

    // Validate required fields
    if (!fullName || !email || !contactReason || !message) {
      return res.status(400).json({
        message: "Missing required fields: fullName, email, contactReason, message"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Please provide a valid email address"
      });
    }

    // Validate contact reason
    const validReasons = ["complaint", "partnership", "information", "other"];
    if (!validReasons.includes(contactReason)) {
      return res.status(400).json({
        message: "Invalid contact reason"
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

    // Create contact record
    const contact = await Contact.create({
      fullName,
      email,
      phone,
      contactReason,
      message,
      companyName,
      website,
      ...attachmentData,
      status: "new"
    });

    // Send email notification to admin
    try {
      const adminEmail = 'derciorosario55@gmail.com'// process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || "admin@54links.com";

      await sendTemplatedEmail({
        to: adminEmail,
        subject: `New Contact Form Submission - ${contactReason}`,
        template: "contact-notification",
        context: {
          subject: `New Contact Form Submission - ${contactReason}`,
          preheader: `New ${contactReason} inquiry from ${fullName}`,
          contact: {
            id: contact.id,
            fullName,
            email,
            phone,
            contactReason,
            message,
            companyName,
            website,
            attachment: req.file ? {
              name: req.file.originalname,
              url: req.savedFileUrl,
              type: req.file.mimetype
            } : null,
            submittedAt: contact.createdAt
          }
        },
      });
    } catch (emailError) {
      // Log email error but don't fail the request
      console.error("Failed to send contact notification email:", emailError);
    }

    res.status(201).json({
      message: "Contact form submitted successfully",
      contactId: contact.id
    });

  } catch (error) {
    console.error("Contact submission error:", error);
    next(error);
  }
}

// Get all contacts (admin function)
async function getAllContacts(req, res, next) {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const contacts = await Contact.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      contacts: contacts.rows,
      total: contacts.count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
}

// Get contact by ID (admin function)
async function getContactById(req, res, next) {
  try {
    const { id } = req.params;

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    res.json({ contact });
  } catch (error) {
    next(error);
  }
}

// Update contact status (admin function)
async function updateContactStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ["new", "in_progress", "responded", "closed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status. Must be one of: " + validStatuses.join(", ")
      });
    }

    const contact = await Contact.findByPk(id);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const updateData = { status };
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (status === "responded") {
      updateData.respondedAt = new Date();
    }

    await contact.update(updateData);

    res.json({
      message: "Contact updated successfully",
      contact
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitContact,
  getAllContacts,
  getContactById,
  updateContactStatus,
  upload // Export multer upload middleware
};