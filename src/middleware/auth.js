// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const { User } = require("../models");

module.exports = (required = true) => {
  return async (req, res, next) => {
    try {
      const hdr = req.headers.authorization || "";
      const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;

      if (!token) {
        if (required) return res.status(401).json({ message: "Missing token" });
        req.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // normalize to sub
      const sub = decoded.sub || decoded.userId || decoded.id;
      if (!sub) return res.status(401).json({ message: "Invalid token (no subject)" });

      // (optional) verify user exists
      const user = await User.findByPk(sub, { attributes: ["id", "accountType"] });
      if (!user) return res.status(401).json({ message: "User not found" });

      req.user = { sub: user.id, id: user.id, accountType: user.accountType };
      next();
    } catch (e) {
      if (required) return res.status(401).json({ message: "Invalid token" });
      req.user = null;
      next();
    }
  };
};
