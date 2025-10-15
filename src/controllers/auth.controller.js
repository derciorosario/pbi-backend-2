const { createUserAndSendVerification, verifyEmailToken, resendVerification, login, requestPasswordReset, resetPassword } =
  require("../services/auth.service");
const { User, CompanyRepresentative } = require("../models");
const { loginWithGoogle } = require("../services/auth.service");
const jwt = require("jsonwebtoken");


async function register(req, res, next) {
  try {
    const user = await createUserAndSendVerification(req.body);
    res.status(201).json({
      message: "Registered. Check your email to verify your account.",
      user: { id: user.id, email: user.email },
    });
  } catch (err) { next(err); }
}

async function verify(req, res, next) {
  try {
    await verifyEmailToken(req.params.token);
    res.json({ message: "Email verified. You can now log in." });
  } catch (err) { next(err); }
}

async function resend(req, res, next) {
  try {
    await resendVerification(req.body.email);
    res.json({ message: "Verification email sent." });
  } catch (err) { next(err); }
}

async function signIn(req, res, next) {
  try {
    const { user, token } = await login(req.body);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, accountType: user.accountType },
    });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const user = await User.findByPk(req.user.sub);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ id: user.id, name: user.name, email: user.email, accountType: user.accountType });
  } catch (err) { next(err); }
}


async function checkGoogleUserStatus(req, res, next) {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: "Access token is required" });
    }

    // Fetch user info from Google
    const axios = require('axios');
    const profile = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const { sub: googleId, email, email_verified: emailVerified, name, picture } = profile.data;

    if (!email || emailVerified === false) {
      return res.status(400).json({ message: "Invalid Google account" });
    }

    // Check if user already exists
    const { User } = require("../models");
    let user = await User.findOne({ where: { googleId } });
    if (!user) user = await User.findOne({ where: { email } });

    if (user) {
      // User exists, proceed with login
      const { loginWithGoogle } = require("../services/auth.service");
      const { user: loggedInUser, token } = await loginWithGoogle({
        accessToken,
        accountType: user.accountType
      });

      return res.json({
        token,
        user: {
          id: loggedInUser.id,
          name: loggedInUser.name,
          email: loggedInUser.email,
          accountType: loggedInUser.accountType,
          avatarUrl: loggedInUser.avatarUrl,
          provider: loggedInUser.provider,
        },
      });
    } else {
      // User doesn't exist, return user info for account type selection
      return res.json({
        requiresAccountType: true,
        userInfo: {
          googleId,
          email,
          name,
          picture,
        },
      });
    }
  } catch (err) {
    next(err);
  }
}

async function googleSignIn(req, res, next) {
  try {
    const { idToken, accountType, accessToken } = req.body;
    const { user, token } = await loginWithGoogle({ idToken, accountType, accessToken });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
    });
  } catch (err) {
    next(err);
  }
}


async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    // ✅ check if the user exists
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Email not registered" });
    }

    // send the reset link
    await requestPasswordReset(email);

    res.json({ message: "Password reset link has been sent." });
  } catch (err) {
    next(err);
  }
}

async function confirmResetPassword(req, res, next) {
  try {
    const {  token, password } = req.body;
    await resetPassword({ token, password });
    res.json({ message: "Password has been reset successfully. You can now log in." });
  } catch (err) {
    next(err);
  }
}

async function getCompanyToken(req, res, next) {
  try {
    const { companyId } = req.body;
    const userId = req.user.sub;

    // Verify that the user is authorized to represent this company
   /* const representation = await CompanyRepresentative.findOne({
      where: {
        companyId,
        representativeId: userId,
        status: "authorized"
      }
    });

    if (!representation) {
      return res.status(403).json({ message: "You are not authorized to manage this company" });
    }

    **/

    // Get the company user
    const company = await User.findByPk(companyId);
   /* if (!company || company.accountType !== "company") {
      return res.status(404).json({ message: "Company not found" });
    }*/

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }


    // Generate a JWT token for the company
    const token = jwt.sign(
      {
        sub: company.id,
        name: company.name,
        email: company.email,
        accountType: company.accountType,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
      },
      process.env.JWT_SECRET || "fallback-secret"
    );

    res.json({ token,email:company.email });
  } catch (err) {
    next(err);
  }
}


module.exports = {
  forgotPassword,
  confirmResetPassword,
  register,
  verify,
  resend,
  signIn,
  me,
  googleSignIn,
  checkGoogleUserStatus,
  getCompanyToken
};
