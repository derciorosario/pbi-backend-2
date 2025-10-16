const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const dayjs = require("dayjs");
const { User, VerificationToken } = require("../models");
const { sendEmail, sendTemplatedEmail } = require("../utils/email");
const { sign } = require("../utils/jwt");
const { OAuth2Client } = require("google-auth-library");


 // Import all the models we need for deletion
  const {
    CompanyInvitation, CompanyRepresentative, CompanyStaff, OrganizationJoinRequest,
    Job, Event, Service, Product, Tourism, Funding, Moment, Need,
    Message, Conversation, MeetingRequest, Notification,
    Like, Comment, Repost, UserBlock, Report,
    JobApplication, EventRegistration,
    Connection, ConnectionRequest,
    UserSettings, VerificationToken: VT, Profile,
    WorkSample, Gallery,
    UserGoal, UserIdentity, UserCategory, UserSubcategory, UserSubsubCategory,
    UserIdentityInterest, UserCategoryInterest, UserSubcategoryInterest, UserSubsubCategoryInterest,
  } = require("../models");

  const { Op } = require("sequelize");


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

async function loginWithGoogle({ idToken, accessToken,birthDate, accountType = "individual", additionalFields = {} }) {
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

    if(!birthDate){
      return
    }

    user = await User.create(userData);


    // Create Profile with birthDate if provided
    const profileData = { userId: user.id };
    if (birthDate) {
      profileData.birthDate = birthDate;
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

// Send account deletion email with token
async function requestAccountDeletion(email) {
  const user = await User.findOne({ where: { email } });

  // For privacy: always return success, even if user not found
  if (!user) return true;

  // Don't allow deletion of admin accounts
  if (user.accountType === "admin") {
    const e = new Error("Admin accounts cannot be deleted through this method");
    e.status = 403;
    throw e;
  }

  // Invalidate previous deletion tokens
  await VerificationToken.update(
    { usedAt: new Date() },
    { where: { userId: user.id, usedAt: null, type: "delete_account" } }
  );

  // Issue a new token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = dayjs().add(24, "hour").toDate(); // 24h expiry
  await VerificationToken.create({
    userId: user.id,
    token,
    type: "delete_account",
    expiresAt,
  });

  // The user asked that link be BASE_URL/verify/:token
  const link = `${process.env.BASE_URL || ""}/delete-account/${token}`;

  await sendTemplatedEmail({
    to: user.email,
    subject: "Confirm Account Deletion",
    template: "delete-account",
    context: {
      subject: "Confirm Account Deletion",
      preheader: "Please confirm that you want to delete your account.",
      name: user.name,
      link,
      expiresInHours: 24,
    },
  });

  return true;
}

// Verify token + delete account
async function confirmAccountDeletion(token) {
  const record = await VerificationToken.findOne({
    where: { token, type: "delete_account", usedAt: null },
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

   const user = await User.findByPk(record.userId, {
          include: [
            {
              model: Profile, as: "profile",
            },
          ],
    });

  if (!user) {
    const e = new Error("Invalid token");
    e.status = 400;
    throw e;
  }

  // Don't allow deletion of admin accounts
  if (user.accountType === "admin") {
    const e = new Error("Admin accounts cannot be deleted");
    e.status = 403;
    throw e;
  }

 

  // Delete all related records in proper order to avoid foreign key constraint errors

  // 1. Delete company invitations (as company, invited user, or inviter)
  await CompanyInvitation.destroy({
    where: {
      [Op.or]: [
        { companyId: user.id },
        { invitedUserId: user.id },
        { invitedBy: user.id },
        { cancelledBy: user.id }
      ]
    }
  });



  // 2. Delete company representatives
  await CompanyRepresentative.destroy({
    where: {
      [Op.or]: [
        { companyId: user.id },
        { representativeId: user.id },
        { authorizedBy: user.id },
        { revokedBy: user.id }
      ]
    }
  });

  // 3. Delete company staff
  await CompanyStaff.destroy({
    where: {
      [Op.or]: [
        { companyId: user.id },
        { staffId: user.id },
        { invitedBy: user.id },
        { removedBy: user.id }
      ]
    }
  });

  // 4. Delete organization join requests
  await OrganizationJoinRequest.destroy({
    where: {
      [Op.or]: [
        { organizationId: user.id },
        { userId: user.id },
        { cancelledBy: user.id },
        { approvedBy: user.id }
      ]
    }
  });

  // 5. Delete content created by the user
  await Job.destroy({ where: { postedByUserId: user.id } });
  await Event.destroy({ where: { organizerUserId: user.id } });
  await Service.destroy({ where: { providerUserId: user.id } });
  await Product.destroy({ where: { sellerUserId: user.id } });
  await Tourism.destroy({ where: { authorUserId: user.id } });
  await Funding.destroy({ where: { creatorUserId: user.id } });
  await Moment.destroy({ where: { userId: user.id } });
  await Need.destroy({ where: { userId: user.id } });

  // 6. Delete applications and registrations
  await JobApplication.destroy({ where: { userId: user.id } });
  await EventRegistration.destroy({ where: { userId: user.id } });

  // 7. Delete messages (as sender or receiver)
  await Message.destroy({
    where: {
      [Op.or]: [
        { senderId: user.id },
        { receiverId: user.id }
      ]
    }
  });

  // 8. Delete conversations (as user1 or user2)
  await Conversation.destroy({
    where: {
      [Op.or]: [
        { user1Id: user.id },
        { user2Id: user.id }
      ]
    }
  });

  // 9. Delete connection requests (as sender or receiver)
  await ConnectionRequest.destroy({
    where: {
      [Op.or]: [
        { fromUserId: user.id },
        { toUserId: user.id }
      ]
    }
  });

  // 10. Delete connections (as userOne or userTwo)
  await Connection.destroy({
    where: {
      [Op.or]: [
        { userOneId: user.id },
        { userTwoId: user.id }
      ]
    }
  });

  // 11. Delete meeting requests (as requester or recipient)
  await MeetingRequest.destroy({
    where: {
      [Op.or]: [
        { fromUserId: user.id },
        { toUserId: user.id }
      ]
    }
  });

  // 12. Delete notifications
  await Notification.destroy({ where: { userId: user.id } });

   await Comment.destroy({
    where: {
      [Op.or]: [
        { userId: user.id },
        { targetId: user.id }
      ]
    }
  });

   await Repost.destroy({
    where: {
      [Op.or]: [
        { userId: user.id },
        { targetId: user.id }
      ]
    }
  });

  await Like.destroy({
    where: {
      [Op.or]: [
        { userId: user.id },
        { targetId: user.id }
      ]
    }
  });

  // 14. Delete reports and blocks
  await Report.destroy({
    where: {
      [Op.or]: [
        { reporterId: user.id },
        { targetId: user.id }
      ]
    }
  });

  await UserBlock.destroy({
    where: {
      [Op.or]: [
        { blockerId: user.id },
        { blockedId: user.id }
      ]
    }
  });


  await VerificationToken.destroy({ where: { userId: user.id } });

  // 15. Delete profile-related data (these should cascade, but being explicit)
  await WorkSample.destroy({ where: { profileId: user.profile?.id } });
  await Gallery.destroy({ where: { profileId: user.profile?.id } });

  // 16. Delete taxonomy relationships (through tables)
  await UserGoal.destroy({ where: { userId: user.id } });
  await UserIdentity.destroy({ where: { userId: user.id } });
  await UserCategory.destroy({ where: { userId: user.id } });
  await UserSubcategory.destroy({ where: { userId: user.id } });
  await UserSubsubCategory.destroy({ where: { userId: user.id } });

  // Interest relationships
  await UserIdentityInterest.destroy({ where: { userId: user.id } });
  await UserCategoryInterest.destroy({ where: { userId: user.id } });
  await UserSubcategoryInterest.destroy({ where: { userId: user.id } });
  await UserSubsubCategoryInterest.destroy({ where: { userId: user.id } });

  // 17. Finally, delete the user (this will cascade to Profile, UserSettings, VerificationToken)
  await user.destroy();


  // Mark token as used
  record.usedAt = new Date();
  await record.save();

  return true;
}

module.exports = {requestPasswordReset,
  resetPassword, createUserAndSendVerification, verifyEmailToken, resendVerification, login,loginWithGoogle,
  requestAccountDeletion, confirmAccountDeletion };
