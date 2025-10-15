const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organization.controller');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth());

// Get list of organizations for selection
router.get('/organizations', organizationController.getOrganizations);

// Submit organization join request
router.post('/join-request', organizationController.submitJoinRequest);

// Get join requests for organization (admin view)
router.get('/join-requests', organizationController.getJoinRequests);

// Get single join request by token (for email links - public access)
router.get('/join-requests/:id', organizationController.getJoinRequestByToken);

// Get pending join requests count for organization
router.get('/join-requests/pending/count', organizationController.getPendingRequestsCount);

// Approve join request
router.put('/join-requests/:requestId/approve', organizationController.approveJoinRequest);

// Reject join request
router.put('/join-requests/:requestId/reject', organizationController.rejectJoinRequest);

// Cancel join request (by user)
router.put('/join-requests/:requestId/cancel', organizationController.cancelJoinRequest);

// Get user's organization membership status
router.get('/membership-status', organizationController.getMembershipStatus);

module.exports = router;