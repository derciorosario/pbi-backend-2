const crypto = require("crypto");
const dayjs = require("dayjs");
const { Op, where } = require("sequelize");
const { OrganizationJoinRequest } = require('../models');
const {
  User,
  CompanyRepresentative,
  CompanyStaff,
  CompanyInvitation,
  VerificationToken,
  Profile,
  Connection,
  ConnectionRequest,
  Message,
  Event,
  MeetingRequest,
  Notification
} = require("../models");
const { sendTemplatedEmail } = require("../utils/email");

// Helper function to generate secure tokens
function generateSecureToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Helper function to get token expiration date
function getTokenExpiration(hours = 24) {
  return dayjs().add(hours, "hour").toDate();
}

// Invite user to be company representative
exports.inviteRepresentative = async (req, res, next) => {
  try {
    const { representativeId } = req.body;
    const companyId = req.user.sub;

    // Verify the user making the request is a company
    const company = await User.findByPk(companyId);
    if (!company || company.accountType !== "company") {
      return res.status(403).json({ message: "Only companies can invite representatives" });
    }

    // Verify the target user exists and is an individual
    const representative = await User.findByPk(representativeId);
    if (!representative || representative.accountType !== "individual") {
      return res.status(400).json({ message: "Invalid representative user" });
    }

    // Check if invitation already exists
    const existingInvitation = await CompanyInvitation.findOne({
      where: {
        companyId,
        invitedUserId: representativeId,
        invitationType: "representative",
        status: "sent"
      }
    });

    if (existingInvitation) {
      return res.status(400).json({ message: "Invitation already sent to this user" });
    }

    // Check if user is already a representative
    const existingRep = await CompanyRepresentative.findOne({
      where: {
        companyId,
        representativeId,
        status: { [Op.in]: ["pending", "authorized"] }
      }
    });

    if (existingRep) {
      return res.status(400).json({ message: "User is already a representative" });
    }

    // Generate invitation token
    const invitationToken = generateSecureToken();
    const expiresAt = getTokenExpiration(48); // 48 hours for representative invitations

    // Create invitation record
    const invitation = await CompanyInvitation.create({
      companyId,
      invitedUserId: representativeId,
      invitationType: "representative",
      status: "sent",
      invitationToken,
      expiresAt,
      invitedBy: companyId
    });

    // Send invitation email
    const authorizationLink = `${process.env.BASE_URL || ""}/profile/company/${companyId}/authorize?token=${invitationToken}`;

    await sendTemplatedEmail({
      to: representative.email,
      subject: `Authorization Request - ${company.name} Representative`,
      template: "company-representative-request",
      context: {
        subject: `Authorization Request - ${company.name} Representative`,
        preheader: `${company.name} has requested your authorization to act as their company representative.`,
        userName: representative.name,
        companyName: company.name,
        companyEmail: company.email,
        authorizationLink,
        expiresInHours: 48,
      },
    });

    // Create notification for the invited user
    await Notification.create({
      userId: representativeId,
      type: "company.representative.invitation",
      payload: {
        item_id: invitation.id,
        invitationId: invitation.id,
        companyId: companyId,
        companyName: company.name,
        invitedBy: companyId,
        actionLink: `${process.env.BASE_URL || ""}/profile/company/${companyId}/authorize?token=${invitationToken}`
      },
    }).catch(() => {});

    res.json({
      message: "Representative invitation sent successfully",
      invitation: {
        id: invitation.id,
        invitedUserId: representativeId,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error("Error inviting representative:", error);
    next(error);
  }
};

// Handle representative authorization page (GET request with token in query)
exports.handleRepresentativeAuthorizePage = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Authorization Request</title></head>
          <body>
            <h1>Invalid Authorization Request</h1>
            <p>No authorization token provided.</p>
            <p><a href="/">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    // Find the invitation
    const invitation = await CompanyInvitation.findOne({
      where: {
        invitationToken: token,
        invitationType: "representative",
        status: "sent",
        companyId,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [
        { model: User, as: "company", attributes: ["id", "name", "email"] },
        { model: User, as: "invitedUser", attributes: ["id", "name", "email"] }
      ]
    });

    if (!invitation) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid or Expired Authorization Request</title></head>
          <body>
            <h1>Invalid or Expired Authorization Request</h1>
            <p>This authorization request is invalid or has expired.</p>
            <p><a href="/">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    // Return HTML page with authorization form
    const authorizationPage = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Company Representative Authorization</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .company-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
          }
          input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
          }
          .buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 30px;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            text-decoration: none;
            display: inline-block;
          }
          .btn-primary {
            background: #28a745;
            color: white;
          }
          .btn-secondary {
            background: #dc3545;
            color: white;
          }
          .btn-neutral {
            background: #6c757d;
            color: white;
          }
          .btn:hover {
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Company Representative Authorization</h1>
            <p>You have been requested to act as a company representative.</p>
          </div>

          <div class="company-info">
            <h3>Company Details</h3>
            <p><strong>Company:</strong> ${invitation.company.name}</p>
            <p><strong>Email:</strong> ${invitation.company.email}</p>
            <p><strong>Your Role:</strong> Company Representative</p>
            ${invitation.message ? `<p><strong>Message:</strong> ${invitation.message}</p>` : ''}
          </div>

          <form id="authorizationForm">
            <input type="hidden" id="token" value="${token}">
            <input type="hidden" id="companyId" value="${companyId}">

            <div class="form-group">
              <label for="action">Choose an action:</label>
              <select id="action" required>
                <option value="">Select an option</option>
                <option value="authorize">Authorize Request</option>
                <option value="decline">Decline Request</option>
              </select>
            </div>

            <div class="buttons">
              <button type="submit" class="btn btn-primary">Submit</button>
              <a href="/" class="btn btn-neutral">Cancel</a>
            </div>
          </form>
        </div>

        <script>
          document.getElementById('authorizationForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const action = document.getElementById('action').value;
            const token = document.getElementById('token').value;
            const companyId = document.getElementById('companyId').value;

            if (!action) {
              alert('Please select an action');
              return;
            }

            try {
              const response = await fetch('/api/company/representative/authorize', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
                credentials: 'include'
              });

              const result = await response.json();

              if (response.ok) {
                if (action === 'authorize') {
                  alert('Successfully authorized as company representative!');
                } else {
                  alert('Authorization request declined.');
                }
                window.location.href = '/';
              } else {
                alert('Error: ' + result.message);
              }
            } catch (error) {
              console.error('Error:', error);
              alert('An error occurred. Please try again.');
            }
          });
        </script>
      </body>
      </html>
    `;

    res.send(authorizationPage);
  } catch (error) {
    console.error("Error handling representative authorization page:", error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>An error occurred while processing your request.</p>
          <p><a href="/">Return to Home</a></p>
        </body>
      </html>
    `);
  }
};

// Authorize representative request
exports.authorizeRepresentative = async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.sub;

    // Find the invitation
    const invitation = await CompanyInvitation.findOne({
      where: {
        invitationToken: token,
        invitationType: "representative",
        status: "sent",
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [
        { model: User, as: "company", attributes: ["id", "name", "email"] }
      ]
    });

    if (!invitation) {
      return res.status(400).json({ message: "Invalid or expired invitation token" });
    }

    // Verify the user is the one being invited
    /*if (invitation.invitedUserId !== userId) {
      return res.status(403).json({ message: "You are not authorized to accept this invitation" });
    }*/

    // Check if already authorized
    const existingRep = await CompanyRepresentative.findOne({
      where: {
        companyId: invitation.companyId,
        representativeId: invitation.invitedUserId//userId
      }
    });

    if (existingRep && existingRep.status === "authorized") {
      return res.status(400).json({ message: "Already authorized as representative" });
    }

    // Create or update representative record
    if (existingRep) {
      existingRep.status = "authorized";
      existingRep.authorizedAt = new Date();
      await existingRep.save();
    } else {
      await CompanyRepresentative.create({
        companyId: invitation.companyId,
        representativeId: invitation.invitedUserId,
        status: "authorized",
        authorizationToken: generateSecureToken(),
        authorizedAt: new Date()
      });
    }

    // Update invitation status
    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    // Update user flags
    const user = await User.findByPk(invitation.invitedUserId);
    user.isCompanyRepresentative = true;
    user.companyRepresentativeFor = invitation.companyId;
    user.representativeAuthorizedAt = new Date();
    await user.save();

    // Create notification for the company
    await Notification.create({
      userId: invitation.companyId,
      type: "company.representative.authorized",
      payload: {
        item_id: userId,
        representativeId: userId,
        representativeName: user.name,
        companyId: invitation.companyId,
        authorizedBy: userId
      },
    }).catch(() => {});

    res.json({
      message: "Successfully authorized as company representative",
      company: {
        id: invitation.company.id,
        name: invitation.company.name
      }
    });
  } catch (error) {
    console.error("Error authorizing representative:", error);
    next(error);
  }
};

// Invite user to join company staff
exports.inviteStaff = async (req, res, next) => {
  try {
    const { staffId, role = "employee", message } = req.body;
    const companyId = req.user.sub;

    // Verify the user making the request is a company
    const company = await User.findByPk(companyId);
    if (!company || company.accountType !== "company") {
      return res.status(403).json({ message: "Only companies can invite staff" });
    }

    // Verify the target user exists and is an individual
    const staff = await User.findByPk(staffId);
    if (!staff || staff.accountType !== "individual") {
      return res.status(400).json({ message: "Invalid staff user" });
    }

    // Check if invitation already exists
    const existingInvitation = await CompanyInvitation.findOne({
      where: {
        companyId,
        invitedUserId: staffId,
        invitationType: "staff",
        status: "sent"
      }
    });

    if (existingInvitation) {
      return res.status(400).json({ message: "Invitation already sent to this user" });
    }

    // Check if user is already staff
    const existingStaff = await CompanyStaff.findOne({
      where: {
        companyId,
        staffId,
        status: { [Op.in]: ["pending", "confirmed"] }
      }
    });

    if (existingStaff) {
      return res.status(400).json({ message: "User is already staff" });
    }

    // Generate invitation token
    const invitationToken = generateSecureToken();
    const expiresAt = getTokenExpiration(168); // 7 days for staff invitations

    // Create invitation record
    const invitation = await CompanyInvitation.create({
      companyId,
      invitedUserId: staffId,
      invitationType: "staff",
      role,
      status: "sent",
      invitationToken,
      expiresAt,
      invitedBy: companyId,
      message
    });

    // Send invitation email
    const invitationLink = `${process.env.BASE_URL || ""}/profile/company/${companyId}/staff/confirm?token=${invitationToken}`;

     // Create notification for the invited user
    await Notification.create({
      userId: staffId,
      type: "company.staff.invitation",
      payload: {
        item_id: invitation.id,
        invitationId: invitation.id,
        companyId: companyId,
        companyName: company.name,
        role: role,
        invitedBy: companyId,
        actionLink: `${process.env.BASE_URL || ""}/profile/company/${companyId}/staff/confirm?token=${invitationToken}`
      },
    }).catch(() => {});

    await sendTemplatedEmail({
      to: staff.email,
      subject: `Invitation to Join ${company.name} Team`,
      template: "company-staff-invitation",
      context: {
        subject: `Invitation to Join ${company.name} Team`,
        preheader: `${company.name} has invited you to join their team.`,
        userName: staff.name,
        companyName: company.name,
        companyEmail: company.email,
        role,
        message: message || `You have been invited to join ${company.name} as a ${role}.`,
        invitationLink,
        expiresInHours: 168,
      },
    });

   

    res.json({
      message: "Staff invitation sent successfully",
      invitation: {
        id: invitation.id,
        invitedUserId: staffId,
        role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error("Error inviting staff:", error);
    next(error);
  }
};

// Handle staff confirmation page (GET request with token in query)
exports.handleStaffConfirmPage = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Invitation</title></head>
          <body>
            <h1>Invalid Invitation</h1>
            <p>No invitation token provided.</p>
            <p><a href="/">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    // Find the invitation
    const invitation = await CompanyInvitation.findOne({
      where: {
        invitationToken: token,
        invitationType: "staff",
        status: "sent",
        companyId,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [
        { model: User, as: "company", attributes: ["id", "name", "email"] },
        { model: User, as: "invitedUser", attributes: ["id", "name", "email"] }
      ]
    });

    if (!invitation) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid or Expired Invitation</title></head>
          <body>
            <h1>Invalid or Expired Invitation</h1>
            <p>This invitation link is invalid or has expired.</p>
            <p><a href="/">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    // Return HTML page with confirmation form
    const confirmationPage = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Staff Invitation Confirmation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .company-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
          }
          input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
          }
          .buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 30px;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            text-decoration: none;
            display: inline-block;
          }
          .btn-primary {
            background: #007bff;
            color: white;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
          }
          .btn:hover {
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Staff Invitation</h1>
            <p>You have been invited to join the team!</p>
          </div>

          <div class="company-info">
            <h3>Company Details</h3>
            <p><strong>Company:</strong> ${invitation.company.name}</p>
            <p><strong>Email:</strong> ${invitation.company.email}</p>
            <p><strong>Role:</strong> ${invitation.role}</p>
            ${invitation.message ? `<p><strong>Message:</strong> ${invitation.message}</p>` : ''}
          </div>

          <form id="confirmationForm">
            <input type="hidden" id="token" value="${token}">
            <input type="hidden" id="companyId" value="${companyId}">

            <div class="form-group">
              <label for="action">Choose an action:</label>
              <select id="action" required>
                <option value="">Select an option</option>
                <option value="accept">Accept Invitation</option>
                <option value="decline">Decline Invitation</option>
              </select>
            </div>

            <div class="buttons">
              <button type="submit" class="btn btn-primary">Submit</button>
              <a href="/" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>

        <script>
          document.getElementById('confirmationForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const action = document.getElementById('action').value;
            const token = document.getElementById('token').value;
            const companyId = document.getElementById('companyId').value;

            if (!action) {
              alert('Please select an action');
              return;
            }

            try {
              const response = await fetch('/api/company/staff/confirm', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
                credentials: 'include'
              });

              const result = await response.json();

              if (response.ok) {
                if (action === 'accept') {
                  alert('Successfully joined the company staff!');
                } else {
                  alert('Invitation declined.');
                }
                window.location.href = '/';
              } else {
                alert('Error: ' + result.message);
              }
            } catch (error) {
              console.error('Error:', error);
              alert('An error occurred. Please try again.');
            }
          });
        </script>
      </body>
      </html>
    `;

    res.send(confirmationPage);
  } catch (error) {
    console.error("Error handling staff confirmation page:", error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>An error occurred while processing your request.</p>
          <p><a href="/">Return to Home</a></p>
        </body>
      </html>
    `);
  }
};

// Confirm staff invitation
exports.confirmStaffInvitation = async (req, res, next) => {
  try {
    const { token, action = 'accept' } = req.body;
    const userId = req.user.sub;

    // Find the invitation
    const invitation = await CompanyInvitation.findOne({
      where: {
        invitationToken: token,
        invitationType: "staff",
        status: "sent",
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [
        { model: User, as: "company", attributes: ["id", "name", "email"] }
      ]
    });

    if (!invitation) {
      return res.status(400).json({ message: "Invalid or expired invitation token" });
    }

    // Verify the user is the one being invited
    if (invitation.invitedUserId !== userId) {
      return res.status(403).json({ message: "You are not authorized to accept this invitation" });
    }

    // Handle rejection
    if (action === 'reject') {
      // Update invitation status
      invitation.status = "rejected";
      invitation.rejectedAt = new Date();
      invitation.rejectedBy = userId;
      await invitation.save();

      // Create notification for the company
      await Notification.create({
        userId: invitation.companyId,
        type: "company.staff.rejected",
        payload: {
          item_id: invitation.id,
          invitationId: invitation.id,
          staffId: userId,
          staffName: user.name,
          companyId: invitation.companyId,
          role: invitation.role,
          rejectedBy: userId
        },
      }).catch(() => {});

      return res.json({
        message: "Staff invitation declined",
        company: {
          id: invitation.company.id,
          name: invitation.company.name
        }
      });
    }

    // Check if already confirmed
    const existingStaff = await CompanyStaff.findOne({
      where: {
        companyId: invitation.companyId,
        staffId: userId
      }
    });

    if (existingStaff && existingStaff.status === "confirmed") {
      return res.status(400).json({ message: "Already confirmed as staff member" });
    }

    // Create or update staff record
    if (existingStaff) {
      existingStaff.status = "confirmed";
      existingStaff.confirmedAt = new Date();
      await existingStaff.save();
    } else {
      await CompanyStaff.create({
        companyId: invitation.companyId,
        staffId: userId,
        role: invitation.role,
        status: "confirmed",
        invitationToken: generateSecureToken(),
        confirmedAt: new Date(),
        invitedBy: invitation.invitedBy
      });
    }

    // Update invitation status
    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    // Update user flags
    const user = await User.findByPk(userId);
    user.isCompanyStaff = true;
    user.staffOfCompany = invitation.companyId;
    user.staffRole = invitation.role;
    user.staffJoinedAt = new Date();
    await user.save();

    // Create notification for the company
    await Notification.create({
      userId: invitation.companyId,
      type: "company.staff.accepted",
      payload: {
        item_id: invitation.id,
        invitationId: invitation.id,
        staffId: userId,
        staffName: user.name,
        companyId: invitation.companyId,
        role: invitation.role,
        acceptedBy: userId
      },
    }).catch(() => {});

    res.json({
      message: "Successfully joined company staff",
      company: {
        id: invitation.company.id,
        name: invitation.company.name
      },
      role: invitation.role
    });
  } catch (error) {
    console.error("Error confirming staff invitation:", error);
    next(error);
  }
};

// Get company staff members
exports.getCompanyStaff = async (req, res, next) => {
  try {
    const companyId = req.user.sub;

    const staff = await CompanyStaff.findAll({
      where: {
        companyId,
        status: { [Op.in]: ["pending", "confirmed"] }
      },
      include: [
        {
          model: User,
          as: "staff",
          attributes: ["id", "name", "email", "avatarUrl", "city", "country"],
          include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const formattedStaff = staff.map(s => ({
      id: s.id,
      staffId: s.staffId,
      role: s.role,
      status: s.status,
      confirmedAt: s.confirmedAt,
      staff: {
        id: s.staff.id,
        name: s.staff.name,
        email: s.staff.email,
        avatarUrl: s.staff.avatarUrl,
        professionalTitle: s.staff.profile?.professionalTitle,
        city: s.staff.city,
        country: s.staff.country
      }
    }));

    res.json({ staff: formattedStaff });
  } catch (error) {
    console.error("Error getting company staff:", error);
    next(error);
  }
};

// Remove staff member
exports.removeStaff = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const companyId = req.user.sub;


    console.log({staffId,companyId})
    
    const staff = await CompanyStaff.findOne({
      where: {
        companyId,
        staffId,
        status: { [Op.in]: ["pending", "confirmed"] }
      }
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }



    let company=await User.findOne({where:{id:companyId}})

    // Update staff record
    staff.status = "removed";
    staff.removedAt = new Date();
    staff.removedBy = companyId;
    await staff.save();

    // Remove any pending or sent invitations for this staff member
    await CompanyInvitation.destroy({
      where: {
        companyId,
        invitedUserId: staffId,
        invitationType: "staff",
        status: { [Op.in]: ["sent", "pending"] }
      }
    });

    // Update user flags
    const user = await User.findByPk(staffId);
    if (user) {
      user.isCompanyStaff = false;
      user.staffOfCompany = null;
      user.staffRole = null;
      user.staffLeftAt = new Date();
      await user.save();
    }
    

    // Create notification for the removed staff member
    await Notification.create({
      userId: staffId,
      type: "company.staff.removed",
      payload: {
        item_id: staff.id,
        staffId: staffId,
        companyId: companyId,
        companyName: company.name,
        removedBy: companyId,
        role: staff.role
      },
    }).catch(() => {});

    res.json({ message: "Staff member removed successfully" });
  } catch (error) {
    console.error("Error removing staff:", error);
    next(error);
  }
};

// Get company representatives
exports.getCompanyRepresentatives = async (req, res, next) => {
  try {
    const companyId = req.user.sub;

   
    const representatives = await CompanyRepresentative.findAll({
      where: {
        companyId,
        status: { [Op.in]: ["pending", "authorized"] }
      },
      include: [
        {
          model: User,
          as: "representative",
          attributes: ["id", "name", "email", "avatarUrl", "city", "country"],
          include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const formattedReps = representatives.map(r => ({
      id: r.id,
      representativeId: r.representativeId,
      status: r.status,
      authorizedAt: r.authorizedAt,
      representative: {
        id: r.representative.id,
        name: r.representative.name,
        email: r.representative.email,
        avatarUrl: r.representative.avatarUrl,
        professionalTitle: r.representative.profile?.professionalTitle,
        city: r.representative.city,
        country: r.representative.country
      }
    }));

    res.json({ representatives: formattedReps });
  } catch (error) {
    console.error("Error getting company representatives:", error);
    next(error);
  }
};

// Get company invitations
exports.getCompanyInvitations = async (req, res, next) => {
  try {
    const companyId = req.user.sub;
    const { type, status } = req.query;

    let whereClause = { companyId };

    if (type) {
      whereClause.invitationType = type;
    }

    if (status) {
      whereClause.status = status;
    }

    const invitations = await CompanyInvitation.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: "invitedUser",
          attributes: ["id", "name", "email", "avatarUrl", "city", "country"],
          include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"] }]
        }
      ],
      order: [["createdAt", "DESC"]]
    });

    const formattedInvitations = invitations.map(inv => ({
      id: inv.id,
      invitationType: inv.invitationType,
      status: inv.status,
      role: inv.role,
      message: inv.message,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      invitedUser: {
        id: inv.invitedUser.id,
        name: inv.invitedUser.name,
        email: inv.invitedUser.email,
        avatarUrl: inv.invitedUser.avatarUrl,
        professionalTitle: inv.invitedUser.profile?.professionalTitle,
        city: inv.invitedUser.city,
        country: inv.invitedUser.country
      }
    }));

    res.json({ invitations: formattedInvitations });
  } catch (error) {
    console.error("Error getting company invitations:", error);
    next(error);
  }
};

// Cancel invitation
exports.cancelInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const companyId = req.user.sub;

    const invitation = await CompanyInvitation.findOne({
      where: {
        id: invitationId,
        companyId,
        status: "sent"
      }
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found or already processed" });
    }

    // Update invitation status
    invitation.status = "cancelled";
    invitation.cancelledAt = new Date();
    invitation.cancelledBy = companyId;
    await invitation.save();

    res.json({
      message: "Invitation cancelled successfully",
      invitation: {
        id: invitation.id,
        status: invitation.status,
        cancelledAt: invitation.cancelledAt
      }
    });
  } catch (error) {
    console.error("Error cancelling invitation:", error);
    next(error);
  }
};

// Get invitation details by token (for confirmation pages)
exports.getInvitationDetails = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Invitation token is required" });
    }

    // Find the invitation
    const invitation = await CompanyInvitation.findOne({
      where: {
        invitationToken: token,
        status: "sent",
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [
        { model: User, as: "company", attributes: ["id", "name", "email"] },
        { model: User, as: "invitedUser", attributes: ["id", "name", "email"] }
      ]
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invalid or expired invitation token" });
    }

    res.json({
      invitation: {
        id: invitation.id,
        invitationType: invitation.invitationType,
        role: invitation.role,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt
      },
      company: {
        id: invitation.company.id,
        name: invitation.company.name,
        email: invitation.company.email
      }
    });
  } catch (error) {
    console.error("Error getting invitation details:", error);
    next(error);
  }
};

// Resend invitation
exports.resendInvitation = async (req, res, next) => {
  try {
    const { invitationId } = req.params;
    const companyId = req.user.sub;

    const invitation = await CompanyInvitation.findOne({
      where: {
        id: invitationId,
        companyId,
        status: "sent"
      },
      include: [
        { model: User, as: "invitedUser", attributes: ["id", "name", "email"] },
        { model: User, as: "company", attributes: ["id", "name", "email"] }
      ]
    });

    if (!invitation) {
      return res.status(404).json({ message: "Invitation not found or already processed" });
    }

    // Check if invitation has expired
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ message: "Invitation has expired and cannot be resent" });
    }

    // Generate new invitation token
    const newInvitationToken = generateSecureToken();
    const newExpiresAt = getTokenExpiration(
      invitation.invitationType === "representative" ? 48 : 168
    );

    // Update invitation with new token and expiry
    invitation.invitationToken = newInvitationToken;
    invitation.expiresAt = newExpiresAt;
    invitation.resentAt = new Date();
    invitation.resentBy = companyId;
    await invitation.save();

    // Resend email
    const baseUrl = process.env.BASE_URL || "";
    let emailContext = {};

    if (invitation.invitationType === "representative") {
      const authorizationLink = `${baseUrl}/profile/company/${companyId}/authorize?token=${newInvitationToken}`;
      emailContext = {
        subject: `Authorization Request - ${invitation.company.name} Representative`,
        preheader: `${invitation.company.name} has requested your authorization to act as their company representative.`,
        userName: invitation.invitedUser.name,
        companyName: invitation.company.name,
        companyEmail: invitation.company.email,
        authorizationLink,
        expiresInHours: 48,
      };
    } else {
      const invitationLink = `${baseUrl}/profile/company/${companyId}/staff/confirm?token=${newInvitationToken}`;
      emailContext = {
        subject: `Invitation to Join ${invitation.company.name} Team`,
        preheader: `${invitation.company.name} has invited you to join their team.`,
        userName: invitation.invitedUser.name,
        companyName: invitation.company.name,
        companyEmail: invitation.company.email,
        role: invitation.role,
        message: invitation.message || `You have been invited to join ${invitation.company.name} as a ${invitation.role}.`,
        invitationLink,
        expiresInHours: 168,
      };
    }

    await sendTemplatedEmail({
      to: invitation.invitedUser.email,
      subject: emailContext.subject,
      template: invitation.invitationType === "representative"
        ? "company-representative-request"
        : "company-staff-invitation",
      context: emailContext,
    });

    res.json({
      message: "Invitation resent successfully",
      invitation: {
        id: invitation.id,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        resentAt: invitation.resentAt
      }
    });
  } catch (error) {
    console.error("Error resending invitation:", error);
    next(error);
  }
};

// Handle staff confirmation page (GET request with token in query)
exports.handleStaffConfirmPage = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Invitation</title></head>
          <body>
            <h1>Invalid Invitation</h1>
            <p>No invitation token provided.</p>
            <p><a href="/">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    // Find the invitation
    const invitation = await CompanyInvitation.findOne({
      where: {
        invitationToken: token,
        invitationType: "staff",
        status: "sent",
        companyId,
        expiresAt: { [Op.gt]: new Date() }
      },
      include: [
        { model: User, as: "company", attributes: ["id", "name", "email"] },
        { model: User, as: "invitedUser", attributes: ["id", "name", "email"] }
      ]
    });

    if (!invitation) {
      return res.status(400).send(`
        <html>
          <head><title>Invalid or Expired Invitation</title></head>
          <body>
            <h1>Invalid or Expired Invitation</h1>
            <p>This invitation link is invalid or has expired.</p>
            <p><a href="/">Return to Home</a></p>
          </body>
        </html>
      `);
    }

    // Return HTML page with confirmation form
    const confirmationPage = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Staff Invitation Confirmation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .company-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
          }
          input, select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
          }
          .buttons {
            display: flex;
            gap: 10px;
            justify-content: center;
            margin-top: 30px;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            text-decoration: none;
            display: inline-block;
          }
          .btn-primary {
            background: #007bff;
            color: white;
          }
          .btn-secondary {
            background: #6c757d;
            color: white;
          }
          .btn:hover {
            opacity: 0.9;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Staff Invitation</h1>
            <p>You have been invited to join the team!</p>
          </div>

          <div class="company-info">
            <h3>Company Details</h3>
            <p><strong>Company:</strong> ${invitation.company.name}</p>
            <p><strong>Email:</strong> ${invitation.company.email}</p>
            <p><strong>Role:</strong> ${invitation.role}</p>
            ${invitation.message ? `<p><strong>Message:</strong> ${invitation.message}</p>` : ''}
          </div>

          <form id="confirmationForm">
            <input type="hidden" id="token" value="${token}">
            <input type="hidden" id="companyId" value="${companyId}">

            <div class="form-group">
              <label for="action">Choose an action:</label>
              <select id="action" required>
                <option value="">Select an option</option>
                <option value="accept">Accept Invitation</option>
                <option value="decline">Decline Invitation</option>
              </select>
            </div>

            <div class="buttons">
              <button type="submit" class="btn btn-primary">Submit</button>
              <a href="/" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>

        <script>
          document.getElementById('confirmationForm').addEventListener('submit', async function(e) {
            e.preventDefault();

            const action = document.getElementById('action').value;
            const token = document.getElementById('token').value;
            const companyId = document.getElementById('companyId').value;

            if (!action) {
              alert('Please select an action');
              return;
            }

            try {
              const response = await fetch('/api/company/staff/confirm', {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token }),
                credentials: 'include'
              });

              const result = await response.json();

              if (response.ok) {
                if (action === 'accept') {
                  alert('Successfully joined the company staff!');
                } else {
                  alert('Invitation declined.');
                }
                window.location.href = '/';
              } else {
                alert('Error: ' + result.message);
              }
            } catch (error) {
              console.error('Error:', error);
              alert('An error occurred. Please try again.');
            }
          });
        </script>
      </body>
      </html>
    `;

    res.send(confirmationPage);
  } catch (error) {
    console.error("Error handling staff confirmation page:", error);
    res.status(500).send(`
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Error</h1>
          <p>An error occurred while processing your request.</p>
          <p><a href="/">Return to Home</a></p>
        </body>
      </html>
    `);
  }
};

// Get user's company memberships
exports.getUserMemberships = async (req, res, next) => {
  try {
    const userId = req.user.sub;

    const memberships = await CompanyStaff.findAll({
      where: {
        staffId: userId,
        status: { [Op.in]: ["pending", "confirmed"] }
      },
      include: [
        {
          model: User,
          as: "company",
          attributes: ["id", "name", "email", "avatarUrl", "webpage"]
        }
      ],
      order: [["confirmedAt", "DESC"], ["createdAt", "DESC"]]
    });

    const formattedMemberships = memberships.map(membership => ({
      id: membership.id,
      companyId: membership.companyId,
      role: membership.role,
      status: membership.status,
      confirmedAt: membership.confirmedAt,
      joinedAt: membership.confirmedAt || membership.createdAt,
      isMain: membership.isMain || false, // Handle case where column doesn't exist yet
      company: {
        id: membership.company.id,
        name: membership.company.name,
        email: membership.company.email,
        avatarUrl: membership.company.avatarUrl,
        webpage: membership.company.webpage
      }
    }));

    res.json({ memberships: formattedMemberships });
  } catch (error) {
    console.error("Error getting user memberships:", error);
    next(error);
  }
};

// Update staff role
exports.updateStaffRole = async (req, res, next) => {
  try {
    const { staffId } = req.params;
    const { role } = req.body;
    const companyId = req.user.sub;

    if (!role || !role.trim()) {
      return res.status(400).json({ message: "Role is required" });
    }

    const staff = await CompanyStaff.findOne({
      where: {
        companyId,
        staffId,
        status: { [Op.in]: ["pending", "confirmed"] }
      }
    });

    if (!staff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    // Update staff role
    staff.role = role.trim();
    staff.updatedAt = new Date();
    await staff.save();

    // Update user flags if confirmed
    if (staff.status === "confirmed") {
      const user = await User.findByPk(staffId);
      if (user) {
        user.staffRole = role.trim();
        await user.save();
      }
    }

    res.json({
      message: "Staff role updated successfully",
      staff: {
        id: staff.id,
        staffId: staff.staffId,
        role: staff.role,
        status: staff.status
      }
    });
  } catch (error) {
    console.error("Error updating staff role:", error);
    next(error);
  }
};

// Leave company (for staff members)
exports.leaveCompany = async (req, res, next) => {
  try {
    const { membershipId } = req.params;
    const userId = req.user.sub;

    const membership = await CompanyStaff.findOne({
      where: {
        id: membershipId,
        staffId: userId,
        status: { [Op.in]: ["pending", "confirmed"] }
      },
      include: [
        {
          model: User,
          as: "company",
          attributes: ["id", "name", "email"]
        }
      ]
    });

    if (!membership) {
      return res.status(404).json({ message: "Membership not found" });
    }

    // Update membership record
    membership.status = "left";
    membership.leftAt = new Date();
    await membership.save();

    // Remove any pending or sent invitations for this staff member
    await CompanyInvitation.destroy({
      where: {
        companyId: membership.companyId,
        invitedUserId: userId,
        invitationType: "staff",
        status: { [Op.in]: ["sent", "pending"] }
      }
    });

    await OrganizationJoinRequest.destroy({
      where: {
        userId,
        organizationId: membership.companyId,
        status: { [Op.in]: ['pending', 'approved'] }
      }
    });

    // Update user flags
    const user = await User.findByPk(userId);
    if (user) {
      user.isCompanyStaff = false;
      user.staffOfCompany = null;
      user.staffRole = null;
      user.staffLeftAt = new Date();
      await user.save();
    }

    // Create notification for the company
    await Notification.create({
      userId: membership.companyId,
      type: "company.staff.left",
      payload: {
        item_id: membership.id,
        membershipId: membership.id,
        staffId: userId,
        staffName: user.name,
        companyId: membership.companyId,
        companyName: membership.company.name,
        role: membership.role,
        leftBy: userId
      },
    }).catch(() => {});

    res.json({ message: "Successfully left the organization" });
  } catch (error) {
    console.error("Error leaving company:", error);
    next(error);
  }
};

// Set main company
exports.setMainCompany = async (req, res, next) => {
  try {
    const { membershipId } = req.params;
    const userId = req.user.sub;

    const membership = await CompanyStaff.findOne({
      where: {
        id: membershipId,
        staffId: userId,
        status: { [Op.in]: ["pending", "confirmed"] }
      }
    });

    if (!membership) {
      return res.status(404).json({ message: "Membership not found" });
    }

    // First, unset all other main companies for this user
    await CompanyStaff.update(
      { isMain: false },
      {
        where: {
          staffId: userId,
          status: { [Op.in]: ["pending", "confirmed"] },
          id: { [Op.ne]: membershipId } // Exclude current membership
        }
      }
    );

    // Set this company as main
    membership.isMain = true;
    await membership.save();

    res.json({
      message: "Main company set successfully",
      membership: {
        id: membership.id,
        companyId: membership.companyId,
        isMain: membership.isMain
      }
    });
  } catch (error) {
    console.error("Error setting main company:", error);
    next(error);
  }
};

// Unset main company
exports.unsetMainCompany = async (req, res, next) => {
  try {
    const { membershipId } = req.params;
    const userId = req.user.sub;

    const membership = await CompanyStaff.findOne({
      where: {
        id: membershipId,
        staffId: userId,
        status: { [Op.in]: ["pending", "confirmed"] },
        isMain: true
      }
    });

    if (!membership) {
      return res.status(404).json({ message: "Main company membership not found" });
    }

    // Unset as main company
    membership.isMain = false;
    await membership.save();

    res.json({
      message: "Main company unset successfully",
      membership: {
        id: membership.id,
        companyId: membership.companyId,
        isMain: membership.isMain
      }
    });
  } catch (error) {
    console.error("Error unsetting main company:", error);
    next(error);
  }
};

// Revoke representative authorization
exports.revokeRepresentative = async (req, res, next) => {
  try {
    const { representativeId } = req.params;
    const companyId = req.user.sub;

    const representative = await CompanyRepresentative.findOne({
      where: {
        companyId,
        representativeId,
        status: "authorized"
      }
    });

    if (!representative) {
      return res.status(404).json({ message: "Representative not found" });
    }

    // Update representative record
    representative.status = "revoked";
    representative.revokedAt = new Date();
    representative.revokedBy = companyId;
    await representative.save();

    // Update user flags
    const user = await User.findByPk(representativeId);
    if (user) {
      user.isCompanyRepresentative = false;
      user.companyRepresentativeFor = null;
      user.representativeRevokedAt = new Date();
      await user.save();
    }

    // Create notification for the revoked representative
    await Notification.create({
      userId: representativeId,
      type: "company.representative.revoked",
      payload: {
        item_id: representative.id,
        representativeId: representativeId,
        companyId: companyId,
        companyName: company.name,
        revokedBy: companyId
      },
    }).catch(() => {});

    res.json({ message: "Representative authorization revoked successfully" });
  } catch (error) {
    console.error("Error revoking representative:", error);
    next(error);
  }
};

// Get company totals for representative dashboard
exports.getCompanyTotals = async (req, res, next) => {
  try {
    const userId = req.user.sub;

    // Get all companies this user represents
    const representations = await CompanyRepresentative.findAll({
      where: {
        representativeId: userId,
        status: "authorized"
      },
      include: [
        {
          model: User,
          as: "company",
          attributes: ["id", "name", "email", "avatarUrl"]
        }
      ]
    });

    const companyTotals = await Promise.all(
      representations.map(async (rep) => {
        const companyId = rep.companyId;

        // Get full company details including profile information
        const company = await User.findByPk(companyId, {
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["professionalTitle", "about"]
            }
          ],
          attributes: [
            "id", "name", "email", "avatarUrl", "webpage",
            "city", "country", "countryOfResidence", "phone",
            "biography", "accountType", "createdAt"
          ]
        });

        // 1. Total connections for the company
        const totalConnections = await Connection.count({
          where: {
            [Op.or]: [
              { userOneId: companyId },
              { userTwoId: companyId }
            ]
          }
        });

        // 2. Total new messages (unread messages received by the company)
        const totalNewMessages = await Message.count({
          where: {
            receiverId: companyId,
            read: false
          }
        });

        // 3. Total new or pending connection requests (received by the company)
        const totalNewRequests = await ConnectionRequest.count({
          where: {
            toUserId: companyId,
            status: { [Op.in]: ["pending"] }
          }
        });

        // 4. Total upcoming meetings (accepted meeting requests where company is recipient and scheduledAt is in future)
        const totalUpcomingMeetings = await MeetingRequest.count({
          where: {
            toUserId: companyId,
            status: "accepted",
            scheduledAt: { [Op.gt]: new Date() }
          }
        });

        // Additional company statistics
        const totalStaff = await CompanyStaff.count({
          where: {
            companyId,
            status: { [Op.in]: ["pending", "confirmed"] }
          }
        });

        const totalRepresentatives = await CompanyRepresentative.count({
          where: {
            companyId,
            status: "authorized"
          }
        });

        return {
          companyId,
          representation: {
            id: rep.id,
            status: rep.status,
            authorizedAt: rep.authorizedAt,
            notes: rep.notes
          },
          company: {
            id: company.id,
            name: company.name,
            email: company.email,
            avatarUrl: company.avatarUrl,
            webpage: company.webpage,
            city: company.city,
            country: company.country,
            countryOfResidence: company.countryOfResidence,
            phone: company.phone,
            biography: company.biography,
            accountType: company.accountType,
            createdAt: company.createdAt,
            profile: company.profile
          },
          totals: {
            connections: totalConnections,
            newMessages: totalNewMessages,
            newRequests: totalNewRequests,
            upcomingMeetings: totalUpcomingMeetings,
            staff: totalStaff,
            representatives: totalRepresentatives
          }
        };
      })
    );

    res.json({ companies: companyTotals });
  } catch (error) {
    console.error("Error getting company totals:", error);
    next(error);
  }
};