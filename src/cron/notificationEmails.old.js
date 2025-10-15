
// src/cron/notificationEmails.js
const CronJob = require('cron').CronJob;
const {
  User,
  UserSettings,
  Connection,
  Job,
  Event,
  Service,
  Product,
  Tourism,
  Funding,
  Profile,
  Category,
  Subcategory,
  SubsubCategory,
  Identity,
  UserCategory,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest
} = require('../models');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const handlebars = require('handlebars');

// Email template paths
const emailTemplatesDir = path.join(__dirname, '../emails/templates');
const connectionUpdateTemplate = fs.readFileSync(path.join(emailTemplatesDir, 'connection-update.hbs'), 'utf8');
const recommendationTemplate = fs.readFileSync(path.join(emailTemplatesDir, 'connection-recommendation.hbs'), 'utf8');
const jobOpportunityTemplate = fs.readFileSync(path.join(emailTemplatesDir, 'job-opportunity.hbs'), 'utf8');

// Compile templates
const connectionUpdateHtml = handlebars.compile(connectionUpdateTemplate);
const recommendationHtml = handlebars.compile(recommendationTemplate);
const jobOpportunityHtml = handlebars.compile(jobOpportunityTemplate);

// Create email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'mail.visum.co.mz',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'vlms@visum.co.mz',
    pass: process.env.EMAIL_PASSWORD || 'Maremoto2025'
  },
  tls: {
    rejectUnauthorized: false // For development environments
  }
});

console.log({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // For development environments
  }
})

/**
 * Send an email
 * @param {Object} options - Email options
 * @returns {Promise} Promise that resolves when email is sent
 */
async function sendEmail(options) {
  try {
    const { to, subject, html } = options;

    console.log({options})
    await transporter.sendMail({
      from: `"54Links Alert" <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Get users who should receive emails based on frequency
 * @param {String} frequency - Email frequency (daily, weekly, monthly)
 * @returns {Promise<Array>} Promise that resolves to array of users
 */
async function getUsersByFrequency(frequency) {
  try {
    // Find users with matching frequency or 'auto' (which adapts to activity)
    const settings = await UserSettings.findAll({
      where: {
        [Op.or]: [
          { emailFrequency: frequency },
          { emailFrequency: 'auto' } // Auto will receive emails based on activity level
        ]
      },
      include: [
        {
          model: User,
          as: 'user',
          where: { isVerified: true }, // Only verified users
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Filter out 'auto' users based on activity level
    // For simplicity, we'll include all 'auto' users for now
    // In a real implementation, you would check their activity level
    
    return settings;
  } catch (error) {
    console.error('Error getting users by frequency:', error);
    return [];
  }
}

/**
 * Get connection updates for a user
 * @param {String} userId - User ID
 * @param {Date} since - Date to check updates since
 * @returns {Promise<Array>} Promise that resolves to array of updates
 */

async function getConnectionUpdates(userId, since) {
  try {
    // Get user's connections (both sides)
    const connections = await Connection.findAll({
      where: { [Op.or]: [{ userOneId: userId }, { userTwoId: userId }] },
      attributes: ['userOneId', 'userTwoId']
    });

    const connectedUserIds = connections.map(c =>
      c.userOneId === userId ? c.userTwoId : c.userOneId
    );

    if (connectedUserIds.length === 0) return [];

    // Fetch newest content from connected users using the RIGHT aliases + FKs
    const [events, services, products, tourismPosts, fundingPosts] = await Promise.all([
      // Event: organizerUserId / organizer
      Event.findAll({
        where: {
          organizerUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'organizer', attributes: ['id', 'name', 'avatarUrl'] }
        ]
      }),

      // Service: providerUserId / provider
      Service.findAll({
        where: {
          providerUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'provider', attributes: ['id', 'name', 'avatarUrl'] }
        ]
      }),

      // Product: sellerUserId / seller
      Product.findAll({
        where: {
          sellerUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'seller', attributes: ['id', 'name', 'avatarUrl'] }
        ]
      }),

      // Tourism: authorUserId / author
      Tourism.findAll({
        where: {
          authorUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'author', attributes: ['id', 'name', 'avatarUrl'] }
        ]
      }),

      // Funding: creatorUserId / creator
      Funding.findAll({
        where: {
          creatorUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since },
          status: { [Op.ne]: 'draft' } // avoid drafts in emails
        },
        include: [
          { model: User, as: 'creator', attributes: ['id', 'name', 'avatarUrl'] }
        ]
      })
    ]);

    // Normalize to common shape and stable links
    const updates = [
      ...events.map(e => ({
        type: 'event',
        title: e.title,
        description: e.description,
        createdBy: e.organizer,                      // normalize alias -> createdBy
        createdAt: e.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/events/${e.id}`
      })),
      ...services.map(s => ({
        type: 'service',
        title: s.title,
        description: s.description,
        createdBy: s.provider,
        createdAt: s.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/services/${s.id}`
      })),
      ...products.map(p => ({
        type: 'product',
        title: p.title,
        description: p.description,
        createdBy: p.seller,
        createdAt: p.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/products/${p.id}`
      })),
      ...tourismPosts.map(t => ({
        type: 'tourism',
        title: t.title,
        description: t.description,
        createdBy: t.author,
        createdAt: t.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/tourism/${t.id}`
      })),
      ...fundingPosts.map(f => ({
        type: 'funding',
        title: f.title,
        description: f.pitch,                        // pitch -> description for template
        createdBy: f.creator,
        createdAt: f.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/funding/${f.id}`
      }))
    ];

    // Sort newest first
    return updates.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting connection updates:', error);
    return [];
  }
}


/**
 * Get job recommendations for a user
 * @param {String} userId - User ID
 * @param {Date} since - Date to check jobs since
 * @returns {Promise<Array>} Promise that resolves to array of job recommendations
 */
async function getJobRecommendations(userId, since) {
  try {
    // Get the user and their interests/attributes
    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserCategory,
          as: "interests",
          attributes: ["categoryId", "subcategoryId"],
        },
        {
          model: Profile,
          as: "profile",
          attributes: ["categoryId", "subcategoryId"],
        },
        // Get user's interest data
        {
          model: UserCategoryInterest,
          as: "categoryInterests",
          include: [{ model: Category, as: "category", attributes: ["id", "name"] }]
        },
        {
          model: UserSubcategoryInterest,
          as: "subcategoryInterests",
          include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"] }]
        },
        {
          model: UserSubsubCategoryInterest,
          as: "subsubInterests",
          include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }]
        },
        {
          model: UserIdentityInterest,
          as: "identityInterests",
          include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }]
        }
      ]
    });
    
    if (!user) return [];

    // Extract user's interests and attributes
    const userDefaults = {
      country: user.country || null,
      city: user.city || null,
      // What the user is looking for (interests)
      interestCategoryIds: (user.categoryInterests || []).map(i => i.categoryId).filter(Boolean),
      interestSubcategoryIds: (user.subcategoryInterests || []).map(i => i.subcategoryId).filter(Boolean),
      interestSubsubCategoryIds: (user.subsubInterests || []).map(i => i.subsubCategoryId).filter(Boolean),
      interestIdentityIds: (user.identityInterests || []).map(i => i.identityId).filter(Boolean),
      // What the user is (attributes)
      attributeCategoryIds: [],
      attributeSubcategoryIds: [],
      attributeSubsubCategoryIds: [],
      attributeIdentityIds: [],
    };

    // Extract what the user is (attributes)
    const attributeCats = (user.interests || [])
      .map((i) => i.categoryId)
      .filter(Boolean);
    const attributeSubs = (user.interests || [])
      .map((i) => i.subcategoryId)
      .filter(Boolean);

    // Add profile attributes
    if (user.profile?.categoryId) attributeCats.push(user.profile.categoryId);
    if (user.profile?.subcategoryId) attributeSubs.push(user.profile.subcategoryId);

    // Store unique IDs for attributes
    userDefaults.attributeCategoryIds = Array.from(new Set(attributeCats));
    userDefaults.attributeSubcategoryIds = Array.from(new Set(attributeSubs));

    // Get jobs with audience associations
    const jobs = await Job.findAll({
      where: {
        createdAt: { [Op.gte]: since },
        // Exclude jobs created by the user
        postedByUserId: { [Op.ne]: userId }
      },
      include: [
        {
          model: User,
          as: 'postedBy',
          attributes: ['id', 'name', 'avatarUrl'],
          include: [
            { model: Profile, as: "profile", attributes: ["avatarUrl"] }
          ]
        },
        { model: Category, as: "category", attributes: ["id", "name"] },
        { model: Subcategory, as: "subcategory", attributes: ["id", "name"] },
        { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] },
        // Audience associations
        {
          model: Category,
          as: "audienceCategories",
          attributes: ["id", "name"],
          through: { attributes: [] }
        },
        {
          model: Subcategory,
          as: "audienceSubcategories",
          attributes: ["id", "name"],
          through: { attributes: [] }
        },
        {
          model: SubsubCategory,
          as: "audienceSubsubs",
          attributes: ["id", "name"],
          through: { attributes: [] }
        },
        {
          model: Identity,
          as: "audienceIdentities",
          attributes: ["id", "name"],
          through: { attributes: [] }
        }
      ],
      limit: 10 // Get more jobs to filter by match percentage
    });

    // Calculate match percentage for each job
    const scoredJobs = jobs.map(job => {
      const matchPercentage = calculateJobMatchPercentage(userDefaults, job);
      return {
        id: job.id,
        title: job.title,
        company: job.companyName,
        location: job.city ? `${job.city}, ${job.country}` : job.country,
        description: job.description,
        createdBy: job.postedBy,
        createdAt: job.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/jobs/${job.id}`,
        matchPercentage
      };
    });

    // Sort by match percentage (highest first) and take top 5
    return scoredJobs
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, 5);
  } catch (error) {
    console.error('Error getting job recommendations:', error);
    return [];
  }
}

/**
 * Calculate match percentage between a user and a job
 * @param {Object} userDefaults - User's interests and attributes
 * @param {Object} job - The job to compare with
 * @returns {Number} Match percentage (0-100)
 */
function calculateJobMatchPercentage(userDefaults, job) {
  // Extract job's taxonomies
  const jobTaxonomies = {
    categories: [
      ...(job.audienceCategories || []).map(c => String(c.id)),
      job.categoryId ? String(job.categoryId) : null
    ].filter(Boolean),
    subcategories: [
      ...(job.audienceSubcategories || []).map(s => String(s.id)),
      job.subcategoryId ? String(job.subcategoryId) : null
    ].filter(Boolean),
    subsubcategories: [
      ...(job.audienceSubsubs || []).map(s => String(s.id)),
      job.subsubCategoryId ? String(job.subsubCategoryId) : null
    ].filter(Boolean),
    identities: (job.audienceIdentities || []).map(i => String(i.id)).filter(Boolean)
  };

  // Create sets for efficient lookups
  // Interest sets (what the user is looking for) - higher priority
  const interestCatSet = new Set(userDefaults.interestCategoryIds || []);
  const interestSubSet = new Set(userDefaults.interestSubcategoryIds || []);
  const interestXSet = new Set(userDefaults.interestSubsubCategoryIds || []);
  const interestIdSet = new Set(userDefaults.interestIdentityIds || []);
  
  // Attribute sets (what the user is) - lower priority
  const attrCatSet = new Set(userDefaults.attributeCategoryIds || []);
  const attrSubSet = new Set(userDefaults.attributeSubcategoryIds || []);
  
  const userCity = (userDefaults.city || "").toLowerCase();
  const userCountry = userDefaults.country || null;

  // Define weights for different match types (total should be 100)
  const WEIGHTS = {
    category: 25,       // Category interest match
    subcategory: 30,    // Subcategory interest match
    subsubcategory: 20, // Subsubcategory interest match
    identity: 15,       // Identity interest match
    location: 10,       // Location match
  };

  // Calculate score for each factor
  let totalScore = 0;
  let matchedFactors = 0;
  let matchDetails = [];

  // Category matches - check both interest and attribute sets
  if ((interestCatSet.size > 0 || attrCatSet.size > 0) && jobTaxonomies.categories.length > 0) {
    // Check interest matches first (higher priority)
    if (interestCatSet.size > 0) {
      const catMatches = jobTaxonomies.categories.filter(id => interestCatSet.has(id));
      if (catMatches.length > 0) {
        // Calculate percentage of matching categories
        const catMatchPercentage = Math.min(1, catMatches.length /
          Math.max(interestCatSet.size, jobTaxonomies.categories.length));
        
        totalScore += WEIGHTS.category * catMatchPercentage * 1.5; // Boost interest matches
        matchedFactors++;
        matchDetails.push(`Category interest match: ${catMatches.length} categories`);
      }
    }
    
    // Check attribute matches (lower priority)
    if (attrCatSet.size > 0) {
      const catMatches = jobTaxonomies.categories.filter(id => attrCatSet.has(id));
      if (catMatches.length > 0) {
        // Calculate percentage of matching categories
        const catMatchPercentage = Math.min(1, catMatches.length /
          Math.max(attrCatSet.size, jobTaxonomies.categories.length));
        
        totalScore += WEIGHTS.category * catMatchPercentage * 0.5; // Lower weight for attribute matches
        matchedFactors++;
        matchDetails.push(`Category attribute match: ${catMatches.length} categories`);
      }
    }
  }

  // Subcategory matches - check both interest and attribute sets
  if ((interestSubSet.size > 0 || attrSubSet.size > 0) && jobTaxonomies.subcategories.length > 0) {
    // Check interest matches first (higher priority)
    if (interestSubSet.size > 0) {
      const subMatches = jobTaxonomies.subcategories.filter(id => interestSubSet.has(id));
      if (subMatches.length > 0) {
        // Calculate percentage of matching subcategories
        const subMatchPercentage = Math.min(1, subMatches.length /
          Math.max(interestSubSet.size, jobTaxonomies.subcategories.length));
        
        totalScore += WEIGHTS.subcategory * subMatchPercentage * 1.5; // Boost interest matches
        matchedFactors++;
        matchDetails.push(`Subcategory interest match: ${subMatches.length} subcategories`);
      }
    }
    
    // Check attribute matches (lower priority)
    if (attrSubSet.size > 0) {
      const subMatches = jobTaxonomies.subcategories.filter(id => attrSubSet.has(id));
      if (subMatches.length > 0) {
        // Calculate percentage of matching subcategories
        const subMatchPercentage = Math.min(1, subMatches.length /
          Math.max(attrSubSet.size, jobTaxonomies.subcategories.length));
        
        totalScore += WEIGHTS.subcategory * subMatchPercentage * 0.5; // Lower weight for attribute matches
        matchedFactors++;
        matchDetails.push(`Subcategory attribute match: ${subMatches.length} subcategories`);
      }
    }
  }

  // Subsubcategory matches
  if (interestXSet.size > 0 && jobTaxonomies.subsubcategories.length > 0) {
    const xMatches = jobTaxonomies.subsubcategories.filter(id => interestXSet.has(id));
    if (xMatches.length > 0) {
      // Calculate percentage of matching subsubcategories
      const xMatchPercentage = Math.min(1, xMatches.length /
        Math.max(interestXSet.size, jobTaxonomies.subsubcategories.length));
      
      totalScore += WEIGHTS.subsubcategory * xMatchPercentage * 1.2; // Slight boost for specificity
      matchedFactors++;
      matchDetails.push(`Subsubcategory match: ${xMatches.length} subsubcategories`);
    }
  }

  // Identity matches
  if (interestIdSet.size > 0 && jobTaxonomies.identities.length > 0) {
    const idMatches = jobTaxonomies.identities.filter(id => interestIdSet.has(id));
    if (idMatches.length > 0) {
      // Calculate percentage of matching identities
      const idMatchPercentage = Math.min(1, idMatches.length /
        Math.max(interestIdSet.size, jobTaxonomies.identities.length));
      
      totalScore += WEIGHTS.identity * idMatchPercentage * 1.2; // Slight boost for identity matches
      matchedFactors++;
      matchDetails.push(`Identity match: ${idMatches.length} identities`);
    }
  }

  // Location match
  const jobCity = (job.city || "").toLowerCase();
  const jobCountry = job.country || null;

  // Exact city match
  if (userCity && jobCity && userCity === jobCity) {
    totalScore += WEIGHTS.location * 0.8; // 80% of location score for exact city match
    matchedFactors++;
    matchDetails.push(`Exact city match: ${userCity}`);
  }
  // Partial city name matching
  else if (userCity && jobCity &&
           (jobCity.includes(userCity) || userCity.includes(jobCity))) {
    totalScore += WEIGHTS.location * 0.4; // 40% of location score for partial city match
    matchedFactors++;
    matchDetails.push(`Partial city match: ${userCity} - ${jobCity}`);
  }
  // Country match
  else if (userCountry && jobCountry === userCountry) {
    totalScore += WEIGHTS.location * 0.5; // 50% of location score for country match
    matchedFactors++;
    matchDetails.push(`Country match: ${userCountry}`);
  }

  // Apply a penalty if fewer than 3 factors matched
  const REQUIRED_FACTORS = 3;
  if (matchedFactors < REQUIRED_FACTORS) {
    // Apply a scaling factor based on how many factors matched
    const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
    totalScore = totalScore * scalingFactor;
    matchDetails.push(`Applied scaling factor: ${scalingFactor.toFixed(2)} (${matchedFactors}/${REQUIRED_FACTORS} factors matched)`);
  }

  // Boost the score to ensure more variation
  // This helps create more diverse and meaningful recommendations
  if (totalScore > 0) {
    // Apply a progressive boost to scores above zero
    // Higher scores get a larger percentage boost
    const boostFactor = 1 + (totalScore / 50); // Scores around 50 get a 2x boost
    totalScore = totalScore * boostFactor;
    matchDetails.push(`Applied boost factor: ${boostFactor.toFixed(2)}`);
  }

  // Add a small random variation to prevent all recommendations having the exact same score
  // This helps create more diverse recommendations
  const randomVariation = Math.random() * 5; // Random value between 0 and 5
  totalScore += randomVariation;

  // Ensure the score is between 10 and 100
  // Lower minimum to 10% to allow for more differentiation between low matches
  const finalScore = Math.max(10, Math.min(100, Math.round(totalScore)));
  
  // Log detailed matching information for debugging
  console.log(`Job match calculation for user ${userDefaults.userId || 'unknown'} and job ${job.id || 'unknown'}:`);
  console.log(`- Match details: ${matchDetails.join(', ')}`);
  console.log(`- Raw score: ${totalScore.toFixed(2)}, Final score: ${finalScore}`);
  
  return finalScore;
}

/**
 * Get connection recommendations for a user
 * @param {String} userId - User ID
 * @returns {Promise<Array>} Promise that resolves to array of connection recommendations
 */
async function getConnectionRecommendations(userId) {
  try {
    // Get the user and their interests/attributes
    const user = await User.findByPk(userId, {
      include: [
        {
          model: UserCategory,
          as: "interests",
          attributes: ["categoryId", "subcategoryId"],
        },
        {
          model: Profile,
          as: "profile",
          attributes: ["categoryId", "subcategoryId"],
        },
        // Get user's interest data
        {
          model: UserCategoryInterest,
          as: "categoryInterests",
          include: [{ model: Category, as: "category", attributes: ["id", "name"] }]
        },
        {
          model: UserSubcategoryInterest,
          as: "subcategoryInterests",
          include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"] }]
        },
        {
          model: UserSubsubCategoryInterest,
          as: "subsubInterests",
          include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }]
        },
        {
          model: UserIdentityInterest,
          as: "identityInterests",
          include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }]
        }
      ]
    });
    
    if (!user) return [];

    // Get user's existing connections
    const connections = await Connection.findAll({
      where: {
        [Op.or]: [
          { userOneId: userId },
          { userTwoId: userId }
        ]
      }
    });

    // Extract connected user IDs
    const connectedUserIds = connections.map(conn =>
      conn.userOneId === userId ? conn.userTwoId : conn.userOneId
    );

    // Add the user's own ID to exclude
    connectedUserIds.push(userId);

    // Extract user's interests and attributes
    const userDefaults = {
      country: user.country || null,
      city: user.city || null,
      // What the user is looking for (interests)
      interestCategoryIds: (user.categoryInterests || []).map(i => i.categoryId).filter(Boolean),
      interestSubcategoryIds: (user.subcategoryInterests || []).map(i => i.subcategoryId).filter(Boolean),
      interestSubsubCategoryIds: (user.subsubInterests || []).map(i => i.subsubCategoryId).filter(Boolean),
      interestIdentityIds: (user.identityInterests || []).map(i => i.identityId).filter(Boolean),
      // What the user is (attributes)
      attributeCategoryIds: [],
      attributeSubcategoryIds: [],
      attributeSubsubCategoryIds: [],
      attributeIdentityIds: [],
    };

    // Extract what the user is (attributes)
    const attributeCats = (user.interests || [])
      .map((i) => i.categoryId)
      .filter(Boolean);
    const attributeSubs = (user.interests || [])
      .map((i) => i.subcategoryId)
      .filter(Boolean);

    // Add profile attributes
    if (user.profile?.categoryId) attributeCats.push(user.profile.categoryId);
    if (user.profile?.subcategoryId) attributeSubs.push(user.profile.subcategoryId);

    // Store unique IDs for attributes
    userDefaults.attributeCategoryIds = Array.from(new Set(attributeCats));
    userDefaults.attributeSubcategoryIds = Array.from(new Set(attributeSubs));

    // Find users who are not connected to this user
    const recommendedUsers = await User.findAll({
      where: {
        id: { [Op.notIn]: connectedUserIds },
        isVerified: true
      },
      include: [
        {
          model: UserCategory,
          as: "interests",
          attributes: ["categoryId", "subcategoryId"],
          include: [
            { model: Category, as: "category", attributes: ["id", "name"] },
            { model: Subcategory, as: "subcategory", attributes: ["id", "name"] }
          ]
        },
        {
          model: Profile,
          as: "profile",
          attributes: ["categoryId", "subcategoryId", "avatarUrl", "professionalTitle", "primaryIdentity"]
        },
        {
          model: Category,
          as: "categories",
          attributes: ["id", "name"],
          through: { attributes: [] }
        },
        {
          model: Subcategory,
          as: "subcategories",
          attributes: ["id", "name"],
          through: { attributes: [] }
        }
      ],
      attributes: ['id', 'name', 'email', 'avatarUrl', 'biography', 'country', 'city'],
      limit: 10 // Get more recommendations to filter by match percentage
    });

    // Calculate match percentage for each user
    const scoredUsers = recommendedUsers.map(recommendedUser => {
      const matchPercentage = calculateMatchPercentage(userDefaults, recommendedUser);
      
      // Get categories and subcategories
      const categories = [
        ...(recommendedUser.categories || []).map(c => c.name),
        ...(recommendedUser.interests || [])
          .filter(i => i.category)
          .map(i => i.category.name)
      ];
      
      const subcategories = [
        ...(recommendedUser.subcategories || []).map(s => s.name),
        ...(recommendedUser.interests || [])
          .filter(i => i.subcategory)
          .map(i => i.subcategory.name)
      ];
      
      // Remove duplicates
      const uniqueCategories = [...new Set(categories)];
      const uniqueSubcategories = [...new Set(subcategories)];
      
      return {
        id: recommendedUser.id,
        name: recommendedUser.name,
        avatarUrl: recommendedUser.avatarUrl || recommendedUser.profile?.avatarUrl,
        biography: recommendedUser.biography,
        professionalTitle: recommendedUser.profile?.professionalTitle || '',
        primaryIdentity: recommendedUser.profile?.primaryIdentity || '',
        categories: uniqueCategories,
        subcategories: uniqueSubcategories,
        link: `${process.env.BASE_URL || 'https://54links.com'}/profile/${recommendedUser.id}`,
        matchPercentage
      };
    });

    // Sort by match percentage (highest first) and take top 5
    return scoredUsers
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, 5);
  } catch (error) {
    console.error('Error getting connection recommendations:', error);
    return [];
  }
}

/**
 * Calculate match percentage between a user and another user
 * @param {Object} userDefaults - User's interests and attributes
 * @param {Object} otherUser - The other user to compare with
 * @returns {Number} Match percentage (0-100)
 */
function calculateMatchPercentage(userDefaults, otherUser) {
  // Create sets for efficient lookups
  // Interest sets (what the user is looking for) - higher priority
  const interestCatSet = new Set(userDefaults.interestCategoryIds || []);
  const interestSubSet = new Set(userDefaults.interestSubcategoryIds || []);
  const interestXSet = new Set(userDefaults.interestSubsubCategoryIds || []);
  const interestIdSet = new Set(userDefaults.interestIdentityIds || []);
  
  // Attribute sets (what the user is) - lower priority
  const attrCatSet = new Set(userDefaults.attributeCategoryIds || []);
  const attrSubSet = new Set(userDefaults.attributeSubcategoryIds || []);
  
  const userCity = (userDefaults.city || "").toLowerCase();
  const userCountry = userDefaults.country || null;

  // Extract other user's taxonomies
  const otherUserCats = (otherUser.interests || [])
    .map(i => String(i.categoryId))
    .filter(Boolean);
  
  const otherUserSubs = (otherUser.interests || [])
    .map(i => String(i.subcategoryId))
    .filter(Boolean);
  
  // Add profile category/subcategory if available
  if (otherUser.profile?.categoryId) {
    otherUserCats.push(String(otherUser.profile.categoryId));
  }
  
  if (otherUser.profile?.subcategoryId) {
    otherUserSubs.push(String(otherUser.profile.subcategoryId));
  }

  // Define weights for different match types (total should be 100)
  const WEIGHTS = {
    category: 25,       // Category interest match
    subcategory: 30,    // Subcategory interest match
    subsubcategory: 20, // Subsubcategory interest match
    identity: 15,       // Identity interest match
    location: 10,       // Location match
  };

  // Calculate score for each factor
  let totalScore = 0;
  let matchedFactors = 0;
  let matchDetails = [];

  // Category matches - check both interest and attribute sets
  if ((interestCatSet.size > 0 || attrCatSet.size > 0) && otherUserCats.length > 0) {
    // Check interest matches first (higher priority)
    if (interestCatSet.size > 0) {
      const catMatches = otherUserCats.filter(id => interestCatSet.has(id));
      if (catMatches.length > 0) {
        // Calculate percentage of matching categories
        const catMatchPercentage = Math.min(1, catMatches.length /
          Math.max(interestCatSet.size, otherUserCats.length));
        
        totalScore += WEIGHTS.category * catMatchPercentage * 1.5; // Boost interest matches
        matchedFactors++;
        matchDetails.push(`Category interest match: ${catMatches.length} categories`);
      }
    }
    
    // Check attribute matches (lower priority)
    if (attrCatSet.size > 0) {
      const catMatches = otherUserCats.filter(id => attrCatSet.has(id));
      if (catMatches.length > 0) {
        // Calculate percentage of matching categories
        const catMatchPercentage = Math.min(1, catMatches.length /
          Math.max(attrCatSet.size, otherUserCats.length));
        
        totalScore += WEIGHTS.category * catMatchPercentage * 0.5; // Lower weight for attribute matches
        matchedFactors++;
        matchDetails.push(`Category attribute match: ${catMatches.length} categories`);
      }
    }
  }

  // Subcategory matches - check both interest and attribute sets
  if ((interestSubSet.size > 0 || attrSubSet.size > 0) && otherUserSubs.length > 0) {
    // Check interest matches first (higher priority)
    if (interestSubSet.size > 0) {
      const subMatches = otherUserSubs.filter(id => interestSubSet.has(id));
      if (subMatches.length > 0) {
        // Calculate percentage of matching subcategories
        const subMatchPercentage = Math.min(1, subMatches.length /
          Math.max(interestSubSet.size, otherUserSubs.length));
        
        totalScore += WEIGHTS.subcategory * subMatchPercentage * 1.5; // Boost interest matches
        matchedFactors++;
        matchDetails.push(`Subcategory interest match: ${subMatches.length} subcategories`);
      }
    }
    
    // Check attribute matches (lower priority)
    if (attrSubSet.size > 0) {
      const subMatches = otherUserSubs.filter(id => attrSubSet.has(id));
      if (subMatches.length > 0) {
        // Calculate percentage of matching subcategories
        const subMatchPercentage = Math.min(1, subMatches.length /
          Math.max(attrSubSet.size, otherUserSubs.length));
        
        totalScore += WEIGHTS.subcategory * subMatchPercentage * 0.5; // Lower weight for attribute matches
        matchedFactors++;
        matchDetails.push(`Subcategory attribute match: ${subMatches.length} subcategories`);
      }
    }
  }

  // Location match
  const otherUserCity = (otherUser.city || "").toLowerCase();
  const otherUserCountry = otherUser.country || null;

  // Exact city match
  if (userCity && otherUserCity && userCity === otherUserCity) {
    totalScore += WEIGHTS.location * 0.8; // 80% of location score for exact city match
    matchedFactors++;
    matchDetails.push(`Exact city match: ${userCity}`);
  }
  // Partial city name matching
  else if (userCity && otherUserCity &&
           (otherUserCity.includes(userCity) || userCity.includes(otherUserCity))) {
    totalScore += WEIGHTS.location * 0.4; // 40% of location score for partial city match
    matchedFactors++;
    matchDetails.push(`Partial city match: ${userCity} - ${otherUserCity}`);
  }
  // Country match
  else if (userCountry && otherUserCountry === userCountry) {
    totalScore += WEIGHTS.location * 0.5; // 50% of location score for country match
    matchedFactors++;
    matchDetails.push(`Country match: ${userCountry}`);
  }

  // Apply a penalty if fewer than 3 factors matched
  const REQUIRED_FACTORS = 3;
  if (matchedFactors < REQUIRED_FACTORS) {
    // Apply a scaling factor based on how many factors matched
    const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
    totalScore = totalScore * scalingFactor;
    matchDetails.push(`Applied scaling factor: ${scalingFactor.toFixed(2)} (${matchedFactors}/${REQUIRED_FACTORS} factors matched)`);
  }

  // Boost the score to ensure more variation
  // This helps create more diverse and meaningful recommendations
  if (totalScore > 0) {
    // Apply a progressive boost to scores above zero
    // Higher scores get a larger percentage boost
    const boostFactor = 1 + (totalScore / 50); // Scores around 50 get a 2x boost
    totalScore = totalScore * boostFactor;
    matchDetails.push(`Applied boost factor: ${boostFactor.toFixed(2)}`);
  }

  // Add a small random variation to prevent all recommendations having the exact same score
  // This helps create more diverse recommendations
  const randomVariation = Math.random() * 5; // Random value between 0 and 5
  totalScore += randomVariation;

  // Ensure the score is between 10 and 100
  // Lower minimum to 10% to allow for more differentiation between low matches
  const finalScore = Math.max(10, Math.min(100, Math.round(totalScore)));
  
  // Log detailed matching information for debugging
  console.log(`Match calculation for user ${userDefaults.userId} and other user ${otherUser.id}:`);
  console.log(`- Match details: ${matchDetails.join(', ')}`);
  console.log(`- Raw score: ${totalScore.toFixed(2)}, Final score: ${finalScore}`);
  
  return finalScore;
}

/**
 * Send notification emails based on frequency
 * @param {String} frequency - Email frequency (daily, weekly, monthly)
 */
async function sendNotificationEmails(frequency) {
  try {
    console.log(`Sending ${frequency} notification emails...`);
    
    // Get date range based on frequency
    const now = new Date();
    let since;
    
    switch (frequency) {
      case 'daily':
        since = new Date(now.setDate(now.getDate() - 1)); // 1 day ago
        break;
      case 'weekly':
        since = new Date(now.setDate(now.getDate() - 7)); // 7 days ago
        break;
      case 'monthly':
        since = new Date(now.setMonth(now.getMonth() - 1)); // 1 month ago
        break;
      default:
        since = new Date(now.setDate(now.getDate() - 1)); // Default to 1 day
    }
    

    // Get users who should receive emails
    const userSettings = await getUsersByFrequency(frequency);

    

   

    // Send emails to each user
    for (const setting of userSettings) {
      const user = setting.user;
      console.log({name:user.name,user:user.email})
      const notifications = typeof setting.notifications === 'string' 
        ? JSON.parse(setting.notifications) 
        : setting.notifications;
      
      // Check if user has email
      if (!user || !user.email) continue;
      
      // Connection updates
      if (notifications.connectionUpdates?.email) {
        const updates = await getConnectionUpdates(user.id, since);
        if (updates.length > 0) {
          const html = connectionUpdateHtml({
            name: user.name,
            frequency,
            updates,
            baseUrl: process.env.BASE_URL || 'https://54links.com'
          });
          
          await sendEmail({
            to: user.email,
            subject: `Your ${frequency} connection updates`,
            html
          });
        }
      }
      
      // Connection recommendations
      if (notifications.connectionRecommendations?.email) {
        const recommendations = await getConnectionRecommendations(user.id);
        if (recommendations.length > 0) {
          const html = recommendationHtml({
            name: user.name,
            recommendations,
            baseUrl: process.env.BASE_URL || 'https://54links.com'
          });
          
          await sendEmail({
            to: user.email,
            subject: 'People you may want to connect with',
            html
          });
        }
      }
      
      // Job opportunities
      if (notifications.jobOpportunities?.email) {
        const jobs = await getJobRecommendations(user.id, since);
        if (jobs.length > 0) {
          const html = jobOpportunityHtml({
            name: user.name,
            jobs,
            baseUrl: process.env.BASE_URL || 'https://54links.com'
          });
          
          await sendEmail({
            to: user.email,
            subject: 'Job opportunities for you',
            html
          });
        }
      }
    }
    
    console.log(`Finished sending ${frequency} notification emails`);
  } catch (error) {
    console.error(`Error sending ${frequency} notification emails:`, error);
  }
}

// Create cron jobs for different frequencies
const dailyJob = new CronJob('0 8 * * *', () => { // Run at 8 AM every day
  sendNotificationEmails('daily');
}, null, false, 'UTC');

const weeklyJob = new CronJob('0 8 * * 1', () => { // Run at 8 AM every Monday
  sendNotificationEmails('weekly');
}, null, false, 'UTC');

const monthlyJob = new CronJob('0 8 1 * *', () => { // Run at 8 AM on the 1st of each month
  sendNotificationEmails('monthly');
}, null, false, 'UTC');

// Function to start all cron jobs
function startNotificationCronJobs() {
  dailyJob.start();
  weeklyJob.start();
  monthlyJob.start();
  console.log('Notification email cron jobs started');
}

// Function to stop all cron jobs
function stopNotificationCronJobs() {
  dailyJob.stop();
  weeklyJob.stop();
  monthlyJob.stop();
  console.log('Notification email cron jobs stopped');
}

// For testing purposes
function runNotificationEmailsNow() {
  console.log('Running notification emails now...');
  Promise.all([
    sendNotificationEmails('daily'),
    sendNotificationEmails('weekly'),
    sendNotificationEmails('monthly')
  ]).then(() => {
    console.log('Finished running notification emails');
  });
}

module.exports = {
  startNotificationCronJobs,
  stopNotificationCronJobs,
  runNotificationEmailsNow,
  sendNotificationEmails
};

