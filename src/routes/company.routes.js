const express = require('express');
const router = express.Router();
const C = require("../controllers/company.controller");
const auth = require("../middleware/auth");

// All routes require authentication except invitation endpoints
router.use(auth());

// Company representative routes
router.post("/representative/invite", C.inviteRepresentative);
router.put("/representative/authorize", C.authorizeRepresentative);
router.get("/profile/company/:companyId/authorize", C.handleRepresentativeAuthorizePage);
router.get("/representatives", C.getCompanyRepresentatives);
router.delete("/representative/:representativeId", C.revokeRepresentative);
router.get("/representative/totals", C.getCompanyTotals);

// Company invitation routes
router.get("/invitations", C.getCompanyInvitations);
router.put("/invitations/:invitationId/cancel", C.cancelInvitation);
router.put("/invitations/:invitationId/resend", C.resendInvitation);

// Company staff routes
router.post("/staff/invite", C.inviteStaff);
router.put("/staff/confirm", C.confirmStaffInvitation);
router.get("/staff", C.getCompanyStaff);
router.get("/staff/my-memberships", C.getUserMemberships);
router.put("/staff/:staffId", C.updateStaffRole);
router.delete("/staff/:staffId", C.removeStaff);
router.delete("/staff/membership/:membershipId", C.leaveCompany);
router.put("/staff/membership/:membershipId/set-main", C.setMainCompany);
router.put("/staff/membership/:membershipId/unset-main", C.unsetMainCompany);

// Public invitation routes (no auth required)
router.get("/invitation/:token", C.getInvitationDetails);
router.get("/profile/company/:companyId/staff/confirm", C.handleStaffConfirmPage);

module.exports = router;