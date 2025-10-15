const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const dayjs = require("dayjs");
const { User, VerificationToken, Profile } = require("../models");
const { sendEmail, sendTemplatedEmail } = require("../utils/email");
const { sign } = require("../utils/jwt");
const { OAuth2Client } = require("google-auth-library");

async function createUserAndSendVerification({
  name, email, password, accountType = "individual",
  phone, biography, nationality, countryOfResidence,
  // Individual fields
  avatarUrl, gender,
  // Company fields
  otherCountries, webpage,
  // Profile fields (for birthDate)
  birthDate,
}) {
  const existing = await User.findOne({ where: { email } });
  if (existing) throw Object.assign(new Error("Email already in use"), { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name, email, passwordHash, accountType, phone, biography, nationality, countryOfResidence,
    // Individual fields
    avatarUrl, gender,
    // Company fields
    otherCountries, webpage,
  });

  // Create Profile with birthDate if provided
  const profileData = { userId: user.id };
  if (birthDate) {
    profileData.birthDate = birthDate;
  }
  await Profile.create(profileData);

  // email verification token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = dayjs().add(24, "hour").toDate();
  await VerificationToken.create({ userId: user.id, token, expiresAt, type: "email_verify" });

  const link = `${process.env.BASE_URL || ""}/verify/${token}`;
  
  await sendTemplatedEmail({
  to: user.email,
  subject: "Your verification link",
  template: "verify-email",
  context: {
    subject: "Your verification link",
    preheader: "Here’s a fresh link to verify your 54Links account.",
    name: user.name,
    link,
    expiresInHours: 24,
    year: new Date().getFullYear(),
  },
 });

  return user;
}

async function verifyEmailToken(token) {
  const record = await VerificationToken.findOne({ where: { token, usedAt: null } });
  if (!record) throw Object.assign(new Error("Invalid or used token"), { status: 400 });
  if (new Date(record.expiresAt) < new Date()) throw Object.assign(new Error("Token expired"), { status: 400 });

  const user = await User.findByPk(record.userId);
  if (!user) throw Object.assign(new Error("User not found for token"), { status: 404 });

  user.isVerified = true;
  await user.save();
  record.usedAt = new Date();
  await record.save();

  return user;
}

async function resendVerification(email) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
  if (user.isVerified) throw Object.assign(new Error("User already verified"), { status: 400 });

  // Invalidate old tokens
  await VerificationToken.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null, type: "email_verify" } }
  );

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = dayjs().add(24, "hour").toDate();
  await VerificationToken.create({ userId: user.id, token, expiresAt, type: "email_verify" });

  const link = `${process.env.BASE_URL || ""}/verify/${token}`;
 
  await sendTemplatedEmail({
  to: user.email,
  subject: "Your verification link",
  template: "verify-email",
  context: {
    subject: "Your verification link",
    preheader: "Here’s a fresh link to verify your 54Links account.",
    name: user.name,
    link,
    expiresInHours: 24,
    year: new Date().getFullYear(),
  },
});

  return true;
}



async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  if (!user) throw Object.assign(new Error("Email not found"), { status: 401 });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw Object.assign(new Error("Incorrect password"), { status: 401 });

  if (!user.isVerified) throw Object.assign(new Error("Email not verified"), { status: 403 });

  const token = sign({ sub: user.id, email: user.email, accountType: user.accountType });
  return { user, token };
}


const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload(); // { sub, email, email_verified, name, picture, hd?, ... }
  return payload;
}



async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload(); // { sub, email, email_verified, name, picture, hd?, ... }
}


// Verify an ID token (JWT) from GIS
async function verifyGoogleIdToken(idToken) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload(); // { sub, email, email_verified, name, picture, hd?, ... }
}

// Fetch userinfo using an access token (ya29...) with openid/email/profile scope
async function fetchUserInfoWithAccessToken(accessToken) {
  // Node 18+ has fetch built-in
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`Google userinfo error: ${res.status} ${txt}`);
    err.status = 401;
    throw err;
  }
  return res.json(); // { sub, email, email_verified, name, picture, hd? }
}

// Fetch userinfo using an access token (ya29...) with openid/email/profile scope
async function fetchUserInfoWithAccessToken(accessToken) {
  // Node 18+ has fetch built-in
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(`Google userinfo error: ${res.status} ${txt}`);
    err.status = 401;
    throw err;
  }
  return res.json(); // { sub, email, email_verified, name, picture, hd? }
}

async function loginWithGoogle({ idToken, accessToken, accountType = "individual", additionalFields = {} }) {
  let payload;

  if (idToken) {
    payload = await verifyGoogleIdToken(idToken);
  } else if (accessToken) {
    payload = await fetchUserInfoWithAccessToken(accessToken);
  } else {
    const e = new Error("idToken or accessToken is required");
    e.status = 400;
    throw e;
  }

  const {
    sub: googleId,
    email,
    email_verified: emailVerified,
    name,
    picture,
    hd,
  } = payload || {};

  if (!email) {
    const e = new Error("Google account email missing");
    e.status = 400;
    throw e;
  }
  if (emailVerified === false) {
    const e = new Error("Google account email not verified");
    e.status = 403;
    throw e;
  }

  if (process.env.GOOGLE_ALLOWED_HOSTED_DOMAIN && process.env.GOOGLE_ALLOWED_HOSTED_DOMAIN !== hd) {
    const e = new Error("Unauthorized Google domain");
    e.status = 403;
    throw e;
  }

  // Find existing by googleId or email (link accounts)
  let user = await User.findOne({ where: { googleId } });
  if (!user) user = await User.findOne({ where: { email } });

  if (!user) {
    // Create new Google-based user with additional fields
    const userData = {
      name: name || email.split("@")[0],
      email,
      passwordHash: "GOOGLE_AUTH",
      accountType,
      isVerified: true,
      provider: "google",
      googleId,
      avatarUrl: picture || null,
      ...additionalFields, // Include any additional fields from signup
    };

    user = await User.create(userData);

    // Create Profile with birthDate if provided
    const profileData = { userId: user.id };
    if (additionalFields.birthDate) {
      profileData.birthDate = additionalFields.birthDate;
    }
    await Profile.create(profileData);
  } else {
    // Update linkage & details
    user.googleId = user.googleId || googleId;
    user.provider = "google";
    user.isVerified = true;
    if (!user.avatarUrl) user.avatarUrl = picture;  //if (picture && user.avatarUrl !== picture) user.avatarUrl = picture;
  
    // Update any additional fields if provided
    Object.assign(user, additionalFields);
    await user.save();
  }

  const token = sign({ sub: user.id, email: user.email, accountType: user.accountType });
  return { user, token };
}



// Send reset email with token
async function requestPasswordReset(email) {
  const user = await User.findOne({ where: { email } });

  // For privacy: always return success, even if user not found
  if (!user) return true;

  // Invalidate previous reset tokens
  await VerificationToken.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null, type: "password_reset" } }
  );

  // Issue a new token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = dayjs().add(1, "hour").toDate(); // 1h expiry recommended
  await VerificationToken.create({
    userId: user.id,
    token,
    type: "password_reset",
    expiresAt,
  });

  // The user asked that link be BASE_URL/verify/:token
  const link = `${process.env.BASE_URL || ""}/reset/${token}`;

  await sendTemplatedEmail({
    to: user.email,
    subject: "Reset your password",
    template: "password-reset",
    context: {
      subject: "Reset your password",
      preheader: "Use the link below to set a new password.",
      name: user.name,
      link,
      expiresInHours: 1,
    },
  });

  return true;
}

// Verify token + set new password
async function resetPassword({  token, password }) {
 const record = await VerificationToken.findOne({
    where: { token, type: "password_reset", usedAt: null },
  });
  if (!record) {
    const e = new Error("Invalid or used token");
    e.status = 400;
    throw e;
  }
  if (new Date(record.expiresAt) < new Date()) {
    const e = new Error("Token expired");
    e.status = 400;
    throw e;
  }

  const user = await User.findByPk(record.userId);
  if (!user) {
    const e = new Error("Invalid token");
    e.status = 400;
    throw e;
  }

  // hash & save new password
  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();

  // mark token used + invalidate any other active reset tokens
  record.usedAt = new Date();
  await record.save();
  await VerificationToken.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null, type: "password_reset" } }
  );

  return true;
}

module.exports = {requestPasswordReset,
  resetPassword, createUserAndSendVerification, verifyEmailToken, resendVerification, login,loginWithGoogle };
