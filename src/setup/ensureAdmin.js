const bcrypt = require("bcryptjs");
const { User } = require("../models");

async function ensureAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  
  if (!adminEmail) {
    console.warn("⚠️ ADMIN_EMAIL not set in .env, skipping admin creation");
    return;
  }

  let admin = await User.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    admin = await User.create({
      name: process.env.ADMIN_NAME || "Admin",
      email: adminEmail,
      passwordHash,
      accountType: "admin",
      isVerified: true, // mark verified automatically
    });
    console.log("✅ Default admin created:", admin.email);
  } else {
    console.log("ℹ️ Admin already exists:", admin.email);
  }
}

module.exports = { ensureAdmin };
