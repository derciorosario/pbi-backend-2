const { Op } = require('sequelize');
const crypto = require('crypto');
const { User, OrganizationJoinRequest, CompanyStaff, Notification } = require('../models');
const { sendTemplatedEmail } = require('../utils/email');
const { isEmailNotificationEnabled } = require('../utils/notificationSettings');

class OrganizationController {
  // Get list of organizations for selection
  async getOrganizations(req, res) {
    try {
      const organizations = await User.findAll({
        where: {
          accountType: 'company',
          isVerified: true
        },
        attributes: ['id', 'name', 'avatarUrl', 'webpage', 'country', 'city','email'],
        order: [['name', 'ASC']]
      });

      res.json({ organizations });
    } catch (error) {
      console.error('Error fetching organizations:', error);
      res.status(500).json({ message: 'Failed to fetch organizations' });
    }
  }

  // Submit organization join request
  async submitJoinRequest(req, res) {
    try {
      const { organizationId, message } = req.body;
      const userId = req.user.id;

      // Validate that user is individual
      const user = await User.findByPk(userId);
      if (user.accountType !== 'individual') {
        return res.status(400).json({ message: 'Only individual users can request to join organizations' });
      }

      // Validate organization exists and is a company
      const organization = await User.findByPk(organizationId);
      if (!organization || organization.accountType !== 'company') {
        return res.status(404).json({ message: 'Organization not found' });
      }

      // Check if user already has a pending or approved request
      const existingRequest = await OrganizationJoinRequest.findOne({
        where: {
          userId,
          organizationId,
          status: ['pending', 'approved']
        }
      });

      if (existingRequest) {
        return res.status(400).json({
          message: existingRequest.status === 'approved'
            ? 'You are already a member of this organization'
            : 'You already have a pending request for this organization'
        });
      }

      // Clean up any cancelled or rejected requests for this user-organization combination
      // to prevent unique constraint violations
      await OrganizationJoinRequest.destroy({
        where: {
          userId,
          organizationId,
          status: ['cancelled', 'rejected']
        }
      });

      // Check if user is already a member by checking CompanyStaff
      const existingStaff = await CompanyStaff.findOne({
        where: {
          companyId: organizationId,
          staffId: userId,
          status: { [Op.in]: ['pending', 'confirmed'] }
        }
      });

      if (existingStaff) {
        return res.status(400).json({
          message: existingStaff.status === 'confirmed'
            ? 'You are already a member of this organization'
            : 'You already have a pending membership request for this organization'
        });
      }

      // Generate request token
      const requestToken = crypto.randomBytes(32).toString('hex');

      // Create join request
      const joinRequest = await OrganizationJoinRequest.create({
        organizationId,
        userId,
        message: message || null,
        requestToken,
        status: 'pending'
      });

      // Send email notification to organization admin
      try {
        // Check if organization has enabled email notifications for join requests
        const isEnabled = true// await isEmailNotificationEnabled(organization.id, 'organizationJoinRequests');

        if (isEnabled) {
          const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
          const reviewUrl = `${baseUrl}/organization/join-requests`;

          await sendTemplatedEmail({
            to: organization.email,
            subject: `New Organization Join Request from ${user.name}`,
            template: "organization-join-request",
            context: {
              name: organization.name,
              fromName: user.name,
              message: message || null,
              reviewUrl,
              expiresInDays: 7
            }
          });
        } else {
          console.log(`Email notification skipped for organization ${organization.id} (organizationJoinRequests disabled)`);
        }
      } catch (emailError) {
        console.error('Failed to send join request email:', emailError);
        // Don't fail the request if email fails
      }

      // Create notification for the organization
      await Notification.create({
        userId: organizationId,
        type: "organization.join.request",
        payload: {
          item_id: joinRequest.id,
          requestId: joinRequest.id,
          userId: userId,
          userName: user.name,
          organizationId: organizationId,
          organizationName: organization.name,
          message: message || null,
          requestedBy: userId,
          actionLink: `${process.env.WEBSITE_URL || "https://54links.com"}/organization/join-requests`
        },
      }).catch(() => {});

      res.json({
        message: 'Join request submitted successfully',
        request: {
          id: joinRequest.id,
          status: joinRequest.status,
          createdAt: joinRequest.createdAt
        }
      });
    } catch (error) {
      console.error('Error submitting join request:', error);
      res.status(500).json({ message: 'Failed to submit join request' });
    }
  }

  // Get join requests for organization (admin view)
  async getJoinRequests(req, res) {
    try {
      const organizationId = req.user.id;

      // Verify user is a company
      const organization = await User.findByPk(organizationId);
      if (organization.accountType !== 'company') {
        return res.status(403).json({ message: 'Only organizations can view join requests' });
      }

      const requests = await OrganizationJoinRequest.findAll({
        where: { organizationId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'avatarUrl', 'country', 'city']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      res.json({ requests });
    } catch (error) {
      console.error('Error fetching join requests:', error);
      res.status(500).json({ message: 'Failed to fetch join requests' });
    }
  }

  // Get pending join requests count for organization
  async getPendingRequestsCount(req, res) {
    try {
      const organizationId = req.user.id;

      // Verify user is a company
      const organization = await User.findByPk(organizationId);
      if (organization.accountType !== 'company') {
        return res.status(403).json({ message: 'Only organizations can view join requests' });
      }

      const count = await OrganizationJoinRequest.count({
        where: {
          organizationId,
          status: 'pending'
        }
      });

      res.json({ count });
    } catch (error) {
      console.error('Error fetching pending requests count:', error);
      res.status(500).json({ message: 'Failed to fetch pending requests count' });
    }
  }

  // Approve join request
  async approveJoinRequest(req, res) {
    try {
      const { requestId } = req.params;
      const organizationId = req.user.id;

      const joinRequest = await OrganizationJoinRequest.findOne({
        where: { id: requestId, organizationId },
        include: [{ model: User, as: 'user' }, { model: User, as: 'organization' }]
      });

      if (!joinRequest) {
        return res.status(404).json({ message: 'Join request not found' });
      }

      if (joinRequest.status !== 'pending') {
        return res.status(400).json({ message: 'Request has already been processed' });
      }

      // Update request status
      await joinRequest.update({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: organizationId
      });

      // Automatically create CompanyStaff record for the approved user
      const { CompanyStaff } = require('../models');
      const existingStaff = await CompanyStaff.findOne({
        where: {
          companyId: organizationId,
          staffId: joinRequest.userId
        }
      });

      if (!existingStaff) {
        await CompanyStaff.create({
          companyId: organizationId,
          staffId: joinRequest.userId,
          role: 'employee', // Default role
          status: 'confirmed',
          invitationToken: require('crypto').randomBytes(32).toString('hex'),
          confirmedAt: new Date(),
          invitedBy: organizationId
        });
      } else if (existingStaff.status !== 'confirmed') {
        // Update existing staff record if not already confirmed
        await existingStaff.update({
          status: 'confirmed',
          confirmedAt: new Date()
        });
      }

      // Send confirmation email to user
      try {
        // Check if user has enabled email notifications for organization updates
        const isEnabled = true //await isEmailNotificationEnabled(joinRequest.userId, 'organizationUpdates');

        if (isEnabled) {
          const baseUrl = process.env.WEBSITE_URL || "https://54links.com";
          const profileLink = `${baseUrl}/profile`;

          await sendTemplatedEmail({
            to: joinRequest.user.email,
            subject: `Organization Join Request Approved - ${joinRequest.organization.name}`,
            template: "organization-join-response",
            context: {
              name: joinRequest.user.name,
              organizationName: joinRequest.organization.name,
              accepted: true,
              profileLink
            }
          });
        } else {
          console.log(`Email notification skipped for user ${joinRequest.userId} (organizationUpdates disabled)`);
        }
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
      }

      // Create notification for the user
      await Notification.create({
        userId: joinRequest.userId,
        type: "organization.join.approved",
        payload: {
          item_id: joinRequest.id,
          requestId: joinRequest.id,
          userId: joinRequest.userId,
          userName: joinRequest.user.name,
          organizationId: organizationId,
          organizationName:joinRequest.organization.name,
          approvedBy: organizationId,
          actionLink: `${process.env.WEBSITE_URL || "https://54links.com"}/profile`
        },
      }).catch(() => {});

      res.json({
        message: 'Join request approved successfully',
        user: {
          id: joinRequest.user.id,
          name: joinRequest.user.name,
          email: joinRequest.user.email
        }
      });
    } catch (error) {
      console.error('Error approving join request:', error);
      res.status(500).json({ message: 'Failed to approve join request' });
    }
  }

  // Reject join request
  async rejectJoinRequest(req, res) {
    try {
      const { requestId } = req.params;
      const organizationId = req.user.id;

      const joinRequest = await OrganizationJoinRequest.findOne({
        where: { id: requestId, organizationId },
        include: [{ model: User, as: 'user' }]
      });

      if (!joinRequest) {
        return res.status(404).json({ message: 'Join request not found' });
      }

      if (joinRequest.status !== 'pending') {
        return res.status(400).json({ message: 'Request has already been processed' });
      }

      // Update request status
      await joinRequest.update({
        status: 'rejected',
        rejectedAt: new Date()
      });

      // Send rejection email to user
      try {
        // Check if user has enabled email notifications for organization updates
        const isEnabled = true //await isEmailNotificationEnabled(joinRequest.userId, 'organizationUpdates');

        if (isEnabled) {
          await sendTemplatedEmail({
            to: joinRequest.user.email,
            subject: `Organization Join Request Update - ${joinRequest.organization.name}`,
            template: "organization-join-response",
            context: {
              name: joinRequest.user.name,
              organizationName: joinRequest.organization.name,
              accepted: false
            }
          });
        } else {
          console.log(`Email notification skipped for user ${joinRequest.userId} (organizationUpdates disabled)`);
        }
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
      }

      // Create notification for the user
      await Notification.create({
        userId: joinRequest.userId,
        type: "organization.join.rejected",
        payload: {
          item_id: joinRequest.id,
          requestId: joinRequest.id,
          userId: joinRequest.userId,
          userName: joinRequest.user.name,
          organizationId: organizationId,
          organizationName: joinRequest.organization.name,
          rejectedBy: organizationId,
          actionLink: `${process.env.WEBSITE_URL || "https://54links.com"}/profile`
        },
      }).catch(() => {});

      res.json({
        message: 'Join request rejected',
        user: {
          id: joinRequest.user.id,
          name: joinRequest.user.name,
          email: joinRequest.user.email
        }
      });
    } catch (error) {
      console.error('Error rejecting join request:', error);
      res.status(500).json({ message: 'Failed to reject join request' });
    }
  }

  // Cancel join request (by user)
  async cancelJoinRequest(req, res) {
    try {
      const { requestId } = req.params;
      const userId = req.user.id;

      const joinRequest = await OrganizationJoinRequest.findOne({
        where: { id: requestId, userId }
      });

      if (!joinRequest) {
        return res.status(404).json({ message: 'Join request not found' });
      }

      if (joinRequest.status !== 'pending') {
        return res.status(400).json({ message: 'Request cannot be cancelled' });
      }

      await joinRequest.update({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: userId
      });

      res.json({ message: 'Join request cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling join request:', error);
      res.status(500).json({ message: 'Failed to cancel join request' });
    }
  }

  // Get single join request by token (for email links - public access)
  async getJoinRequestByToken(req, res) {
    try {
      const { id } = req.params;
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ message: 'Token is required' });
      }

      const joinRequest = await OrganizationJoinRequest.findOne({
        where: {
          id,
          requestToken: token,
          status: 'pending'
        },
        include: [
          {
            model: User,
            as: 'organization',
            attributes: ['id', 'name', 'email', 'avatarUrl', 'webpage']
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'avatarUrl']
          }
        ]
      });

      if (!joinRequest) {
        return res.status(404).json({ message: 'Join request not found or token is invalid' });
      }

      // Check if token has expired (48 hours for representative invitations, but we'll use 7 days for join requests)
      const expiresAt = new Date(joinRequest.createdAt);
      expiresAt.setDate(expiresAt.getDate() + 7);

      if (new Date() > expiresAt) {
        return res.status(410).json({ message: 'This join request link has expired' });
      }

      res.json({
        request: {
          id: joinRequest.id,
          organizationId: joinRequest.organizationId,
          userId: joinRequest.userId,
          status: joinRequest.status,
          message: joinRequest.message,
          requestedAt: joinRequest.requestedAt,
          organization: joinRequest.organization,
          user: joinRequest.user
        }
      });
    } catch (error) {
      console.error('Error fetching join request by token:', error);
      res.status(500).json({ message: 'Failed to fetch join request' });
    }
  }

  // Get user's organization membership status
  async getMembershipStatus(req, res) {
    try {
      const userId = req.user.id;

      // Get user's company staff relationships
      const memberships = await CompanyStaff.findAll({
        where: {
          staffId: userId,
          status: { [Op.in]: ['pending', 'confirmed'] }
        },
        include: [
          {
            model: User,
            as: 'company',
            attributes: ['id', 'name', 'email', 'avatarUrl', 'webpage']
          }
        ],
        order: [['confirmedAt', 'DESC'], ['createdAt', 'DESC']]
      });

      const formattedMemberships = memberships.map(membership => ({
        organizationId: membership.companyId,
        organization: {
          id: membership.company.id,
          name: membership.company.name,
          email: membership.company.email,
          avatarUrl: membership.company.avatarUrl,
          webpage: membership.company.webpage
        },
        role: membership.role,
        joinedAt: membership.confirmedAt || membership.createdAt,
        status: membership.status
      }));

      // Return the first (most recent) membership for backward compatibility
      const primaryMembership = formattedMemberships.length > 0 ? formattedMemberships[0] : null;

      res.json({
        membership: primaryMembership ? {
          organizationId: primaryMembership.organizationId,
          organization: primaryMembership.organization,
          role: primaryMembership.role,
          joinedAt: primaryMembership.joinedAt
        } : null,
        memberships: formattedMemberships // Include all memberships for future use
      });
    } catch (error) {
      console.error('Error fetching membership status:', error);
      res.status(500).json({ message: 'Failed to fetch membership status' });
    }
  }
}

module.exports = new OrganizationController();