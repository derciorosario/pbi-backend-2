// src/controllers/settings.controller.js
const { User, UserSettings } = require("../models");
const { cache } = require("../utils/redis");


/**
 * Get user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSettings = async (req, res) => {
  try {
    
    const userId = req.user.id;

    // Find or create user settings
    let [settings, created] = await UserSettings.findOrCreate({
      where: { userId },
      defaults: {
        notifications: JSON.stringify({
          jobOpportunities: { email: true },
          connectionInvitations: { email: true },
          connectionRecommendations: { email: true },
          connectionUpdates: { email: true },
          messages: { email: true },
          meetingRequests: { email: true }
        }),
        emailFrequency: "daily",
        hideMainFeed: false,
        connectionsOnly: false,
        contentType: "all"
      }
    });
  

    // Return the settings
    res.json(settings);
  } catch (error) {
    console.error("Error getting user settings:", error);
    res.status(500).json({ message: "Failed to get user settings" });
  }
};

/**
 * Update user settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notifications, emailFrequency, hideMainFeed, connectionsOnly, contentType, bidirectionalMatch, bidirectionalMatchFormula } = req.body;

    // Validate input
    if (!notifications || !emailFrequency) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate emailFrequency
    const validFrequencies = ["daily", "weekly", "monthly", "auto"];
    if (!validFrequencies.includes(emailFrequency)) {
      return res.status(400).json({ message: "Invalid email frequency" });
    }

    // Validate hideMainFeed
    if (typeof hideMainFeed !== 'boolean') {
      return res.status(400).json({ message: "hideMainFeed must be a boolean" });
    }

    // Validate connectionsOnly
    if (typeof connectionsOnly !== 'boolean') {
      return res.status(400).json({ message: "connectionsOnly must be a boolean" });
    }

    // Validate contentType
    const validContentTypes = ["all", "text", "images"];
    if (!validContentTypes.includes(contentType)) {
      return res.status(400).json({ message: "Invalid content type" });
    }

    // Validate bidirectionalMatch
    if (typeof bidirectionalMatch !== 'boolean') {
      return res.status(400).json({ message: "bidirectionalMatch must be a boolean" });
    }

    // Validate bidirectionalMatchFormula
    const validFormulas = ["simple", "reciprocal"];
    if (!validFormulas.includes(bidirectionalMatchFormula)) {
      return res.status(400).json({ message: "Invalid bidirectional match formula" });
    }

    // Find or create user settings
    let [settings, created] = await UserSettings.findOrCreate({
      where: { userId },
      defaults: {
        notifications: JSON.stringify({
          jobOpportunities: { email: true },
          connectionInvitations: { email: true },
          connectionRecommendations: { email: true },
          connectionUpdates: { email: true },
          messages: { email: true },
          meetingRequests: { email: true }
        }),
        emailFrequency: "daily",
        hideMainFeed: false,
        connectionsOnly: false,
        contentType: "all",
        bidirectionalMatch: true,
        bidirectionalMatchFormula: "reciprocal"
      }
    });

    // Update settings
     if((settings.bidirectionalMatch!= bidirectionalMatch) || (settings.bidirectionalMatchFormula != bidirectionalMatchFormula)){
        await cache.deleteKeys([
          ["feed",req.user.id] 
        ]);
        await cache.deleteKeys([
          ["people",req.user.id] 
        ]);
    }
   

    settings.notifications = typeof notifications === 'string' ? notifications : JSON.stringify(notifications);
    settings.emailFrequency = emailFrequency;
    settings.hideMainFeed = hideMainFeed;
    settings.connectionsOnly = connectionsOnly;
    settings.contentType = contentType;
    settings.bidirectionalMatch = bidirectionalMatch;
    settings.bidirectionalMatchFormula = bidirectionalMatchFormula;

    await settings.save();

    // Return the updated settings
    res.json(settings);
  } catch (error) {
    console.error("Error updating user settings:", error);
    res.status(500).json({ message: "Failed to update user settings" });
  }
};