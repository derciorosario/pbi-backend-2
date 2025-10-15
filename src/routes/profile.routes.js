// src/routes/profile.routes.js
const router = require("express").Router();
const auth = require("../middleware/auth");
const upload = require("../utils/multerConfigAttachments");
const C = require("../controllers/profile.controller");

router.get("/profile/me", auth(true), C.getMe);
router.put("/profile/personal", auth(true), C.updatePersonal);
router.put("/profile/professional", auth(true), C.updateProfessional);


router.put("/profile/do-selections", auth(true), C.updateDoSelections);
router.put("/profile/interest-selections", auth(true), C.updateInterestSelections);
router.put("/profile/industry-selections", auth(true), C.updateIndustrySelections);

// Portfolio routes
router.put("/profile/portfolio", auth(true), C.updatePortfolio);
router.put("/profile/availability", auth(true), C.updateAvailability);
router.put("/profile/avatar", auth(true), C.updateAvatarUrl);
router.get("/profile/work-samples", auth(true), C.getWorkSamples);
router.post("/profile/work-samples", auth(true), C.createWorkSample);
router.put("/profile/work-samples/:id", auth(true), C.updateWorkSample);
router.delete("/profile/work-samples/:id", auth(true), C.deleteWorkSample);

// Gallery routes
router.get("/profile/gallery", auth(true), C.getGallery);
router.post("/profile/gallery", upload.array("imageBase64", 10), auth(true), C.createGalleryItem);
router.put("/profile/gallery/:id", upload.single("imageBase64"), auth(true), C.updateGalleryItem);
router.delete("/profile/gallery/:id", auth(true), C.deleteGalleryItem);
router.put("/profile/gallery/:id/reorder", auth(true), C.reorderGalleryItem);

// Public gallery route for viewing other users' gallery items
router.get("/users/:userId/gallery", C.getUserGallery);

// Company applications and registrations
router.get("/profile/job-applications", auth(true), C.getJobApplicationsForCompany);
router.get("/profile/event-registrations", auth(true), C.getEventRegistrationsForCompany);

module.exports = router;


