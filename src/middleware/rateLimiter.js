const rateLimit = require("express-rate-limit");

// Limit 100 requests per 15 mins per IP
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
