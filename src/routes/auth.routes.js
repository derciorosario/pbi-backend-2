const router = require("express").Router();
const validate = require("../middleware/validate");
const auth = require("../middleware/auth");
const { register, signIn, verify, resend, me, googleSignIn, checkGoogleUserStatus, forgotPassword, confirmResetPassword, getCompanyToken } = require("../controllers/auth.controller");
const rules = require("../validations/auth.validation");

// Signup + email verification flow
router.post("/signup", validate(rules.register), register);
router.get("/verify/:token", validate(rules.verifyEmail), verify);
router.post("/resend-verification", resend);

// Login
router.post("/login", validate(rules.login), signIn);

// Example protected route
router.get("/me", auth(true), me);

router.post("/google", validate(rules.googleLogin), googleSignIn);
router.post("/google/check-status", checkGoogleUserStatus);


// 🔐 Password reset flow
router.post("/forgot-password", validate(rules.forgotPassword), forgotPassword);
router.post("/reset-password", validate(rules.resetPassword), confirmResetPassword);

// Company token for switching
router.post("/company-token", auth(true), getCompanyToken);


module.exports = router;
