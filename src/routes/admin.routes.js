const router = require("express").Router();
const { resetAndRestart } = require("../utils/restart");
const adminController = require("../controllers/admin.controller");
const dashboardController = require("../controllers/dashboard.controller");

const auth = require("../middleware/auth");

// Admin middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.accountType === "admin") {
    return next();
  }
  return res.status(403).json({ message: "Unauthorized: Admin access required" });
};

// Simple guard: only allow in development
router.get("/restart", async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    // return res.status(403).json({ message: "Not allowed in production!" });
  }

  res.json({ message: "Restarting server and resetting database..." });

  // Delay so response is sent before shutdown
  setTimeout(() => {
    resetAndRestart();
  }, 500);
});

// User management routes
router.get("/admin/users", auth(), isAdmin, adminController.getAllUsers);
router.get("/admin/users/export", auth(), isAdmin, adminController.exportUsers);
router.get("/admin/users/:id", auth(), isAdmin, adminController.getUserById);
router.put("/admin/users/:id", auth(), isAdmin, adminController.updateUser);
router.delete("/admin/users/:id", auth(), isAdmin, adminController.deleteUser);
router.put("/admin/users/:id/suspension", auth(), isAdmin, adminController.toggleUserSuspension);

router.get("/admin/dashboard/stats", auth(), isAdmin, dashboardController.getDashboardStats);
router.get("/admin/dashboard/growth", auth(), isAdmin, dashboardController.getUserGrowthData);
router.get("/admin/dashboard/activity", auth(), isAdmin, dashboardController.getRecentActivity);

// Contact management routes

router.get("/admin/contacts", auth(), isAdmin, adminController.getAllContacts);
router.get("/admin/contacts/export", auth(), isAdmin, adminController.exportContacts);
router.get("/admin/contacts/:id", auth(), isAdmin, adminController.getContactById);
router.patch("/admin/contacts/:id/status", auth(), isAdmin, adminController.updateContactStatus);
router.patch("/admin/contacts/:id/read", auth(), isAdmin, adminController.markContactAsRead);
router.patch("/admin/contacts/read-all", auth(), isAdmin, adminController.markAllContactsAsRead);
router.get("/admin/contacts/unread/count", auth(), isAdmin, adminController.getUnreadContactsCount);
router.delete("/admin/contacts/:id", auth(), isAdmin, adminController.deleteContact);

// Support management routes

router.get("/admin/supports", auth(), isAdmin, adminController.getAllSupports);
router.get("/admin/supports/export", auth(), isAdmin, adminController.exportSupports);
router.get("/admin/supports/:id", auth(), isAdmin, adminController.getSupportById);
router.patch("/admin/supports/:id/status", auth(), isAdmin, adminController.updateSupportStatus);
router.patch("/admin/supports/:id/read", auth(), isAdmin, adminController.markSupportAsRead);
router.patch("/admin/supports/read-all", auth(), isAdmin, adminController.markAllSupportsAsRead);
router.get("/admin/supports/unread/count", auth(), isAdmin, adminController.getUnreadSupportsCount);
router.delete("/admin/supports/:id", auth(), isAdmin, adminController.deleteSupport);

// Admin settings routes
router.get("/admin/settings", auth(), isAdmin, adminController.getAdminSettings);
router.put("/admin/settings", auth(), isAdmin, adminController.updateAdminSettings);

module.exports = router;
