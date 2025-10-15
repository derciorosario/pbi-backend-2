const { body, param } = require("express-validator");

const register = [
  body("name").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
  body("accountType").optional().isIn(["individual", "company", "admin"]),
  body("phone").optional().isString().isLength({ max: 40 }),
  body("biography").optional().isString(),
  body("nationality").optional().isString(),
  body("countryOfResidence").optional().isString(),
  body("webpage").optional().isString(),
  body("otherCountries").optional().isArray(),
];

const forgotPassword = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
];
const resetPassword = [
  body("token").isString().isLength({ min: 16 }),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
];


const login = [body("email").isEmail(), body("password").notEmpty()];

const verifyEmail = [param("token").isString().isLength({ min: 16 })];

const googleLogin = [
  body("idToken").optional().isString().isLength({ min: 20 }),
  body("accessToken").optional().isString().isLength({ min: 20 }),
  body().custom(b => !!b.idToken || !!b.accessToken).withMessage("idToken or accessToken is required"),
  body("accountType").optional().isIn(["individual", "company", "admin"]),
];

module.exports = { register, login, verifyEmail, googleLogin,forgotPassword,resetPassword };
