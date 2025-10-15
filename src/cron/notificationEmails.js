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
  Profile,
  Category,
  Subcategory,
  SubsubCategory,
  Identity,
  Funding,
  Goal, // ✅ needed to match people.controller goal logic
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
    rejectUnauthorized: false
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
  tls: { rejectUnauthorized: false }
});

/* ----------------------------- utils ------------------------------ */
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [val];
}

/**
 * Build the same "viewer defaults" used implicitly in people.controller.js
 * - myCategoryIds / mySubcategoryIds: from UserCategory ("interests")
 * - myGoalIds: from Goal association
 * - myCountry / myCity: from User
 */
async function getViewerDefaults(userId) {
  const me = await User.findByPk(userId, {
    attributes: ['id', 'country', 'city'],
    include: [
      { model: UserCategory, as: 'interests', attributes: ['categoryId', 'subcategoryId'] },
      { model: Goal, as: 'goals', attributes: ['id'] }
    ]
  });

  if (!me) {
    return {
      myCategoryIds: [],
      mySubcategoryIds: [],
      myGoalIds: [],
      myCountry: null,
      myCity: null
    };
  }

  return {
    myCategoryIds: (me.interests || []).map(i => String(i.categoryId)).filter(Boolean),
    mySubcategoryIds: (me.interests || []).map(i => String(i.subcategoryId)).filter(Boolean),
    myGoalIds: (me.goals || []).map(g => String(g.id)).filter(Boolean),
    myCountry: me.country || null,
    myCity: me.city || null
  };
}

/**
 * 🔁 EXACT SAME scoring approach as in people.controller.js (searchPeople)
 * - Weights and factor handling identical
 * - No identity/subsub weighting, no boost/random, min=20
 * - Accepts viewer defaults + (optionally) audience filters (unused here)
 */
function calculateUserToUserMatchPercentage(
  viewerDefaults,
  otherUser,
  effAudienceCategoryIds = [],
  effAudienceSubcategoryIds = []
) {
  const {
    myCategoryIds = [],
    mySubcategoryIds = [],
    myGoalIds = [],
    myCountry = null,
    myCity = null
  } = viewerDefaults;

  const userGoalIds = (otherUser.goals || []).map(g => String(g.id));
  const userCats = (otherUser.interests || []).map(i => String(i.categoryId)).filter(Boolean);
  const userSubs = (otherUser.interests || []).map(i => String(i.subcategoryId)).filter(Boolean);

  const MAX_SCORE = 100;
  const REQUIRED_FACTORS = 3;
  const WEIGHTS = {
    category: 30,
    subcategory: 35,
    goal: 25,
    location: 10
  };

  let totalScore = 0;
  let matchedFactors = 0;

  // Categories (include audience category IDs if passed)
  const allMyCategoryIds = [...new Set([...myCategoryIds, ...effAudienceCategoryIds])];
  if (allMyCategoryIds.length > 0 && userCats.length > 0) {
    const catMatches = userCats.filter(id => allMyCategoryIds.includes(id));
    if (catMatches.length > 0) {
      const catMatchPercentage = Math.min(1, catMatches.length / Math.max(myCategoryIds.length, userCats.length));
      totalScore += WEIGHTS.category * catMatchPercentage;
      matchedFactors++;
    }
  }

  // Subcategories (include audience subcategory IDs if passed)
  const allMySubcategoryIds = [...new Set([...mySubcategoryIds, ...effAudienceSubcategoryIds])];
  if (allMySubcategoryIds.length > 0 && userSubs.length > 0) {
    const subMatches = userSubs.filter(id => allMySubcategoryIds.includes(id));
    if (subMatches.length > 0) {
      const subMatchPercentage = Math.min(1, subMatches.length / Math.max(mySubcategoryIds.length, userSubs.length));
      totalScore += WEIGHTS.subcategory * subMatchPercentage;
      matchedFactors++;
    }
  }

  // Goals
  if (myGoalIds.length > 0 && userGoalIds.length > 0) {
    const goalMatches = userGoalIds.filter(id => myGoalIds.includes(id));
    if (goalMatches.length > 0) {
      const goalMatchPercentage = Math.min(1, goalMatches.length / Math.max(myGoalIds.length, userGoalIds.length));
      totalScore += WEIGHTS.goal * goalMatchPercentage;
      matchedFactors++;
    }
  }

  // Location
  let locationScore = 0;
  if (myCountry && otherUser.country && String(myCountry) === String(otherUser.country)) {
    locationScore += 0.6;
  }
  if (myCity && otherUser.city) {
    const myLowerCity = String(myCity).toLowerCase();
    const otherLowerCity = String(otherUser.city).toLowerCase();
    if (otherLowerCity === myLowerCity) {
      locationScore += 0.4;
    } else if (otherLowerCity.includes(myLowerCity) || myLowerCity.includes(otherLowerCity)) {
      locationScore += 0.2;
    }
  }
  if (locationScore > 0) {
    totalScore += WEIGHTS.location * locationScore;
    matchedFactors++;
  }

  if (matchedFactors < REQUIRED_FACTORS) {
    const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
    totalScore = totalScore * scalingFactor;
  }

  return Math.max(20, Math.min(100, Math.round(totalScore)));
}

/* ----------------------- connection updates ----------------------- */
async function getUsersByFrequency(frequency) {
  try {
    const settings = await UserSettings.findAll({
      where: { [Op.or]: [{ emailFrequency: frequency }, { emailFrequency: 'auto' }] },
      include: [{ model: User, as: 'user', where: { isVerified: true }, attributes: ['id', 'name', 'email'] }]
    });
    return settings;
  } catch (error) {
    console.error('Error getting users by frequency:', error);
    return [];
  }
}


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
        link: `${process.env.BASE_URL || 'https://54links.com'}/event/${e.id}`
      })),
      ...services.map(s => ({
        type: 'service',
        title: s.title,
        description: s.description,
        createdBy: s.provider,
        createdAt: s.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/service/${s.id}`
      })),
      ...products.map(p => ({
        type: 'product',
        title: p.title,
        description: p.description,
        createdBy: p.seller,
        createdAt: p.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/product/${p.id}`
      })),
      ...tourismPosts.map(t => ({
        type: 'Experience',
        title: t.title,
        description: t.description,
        createdBy: t.author,
        createdAt: t.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/experience/${t.id}`
      })),
      ...fundingPosts.map(f => ({
        type: 'funding investment',
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


/* ----------------------- job recommendations ---------------------- */
// (Unchanged — uses its own job-specific scoring)
async function getJobRecommendations(userId, since) {
  try {
    const user = await User.findByPk(userId, {
      include: [
        { model: UserCategory, as: 'interests', attributes: ['categoryId', 'subcategoryId'] },
        { model: Profile, as: 'profile', attributes: ['categoryId', 'subcategoryId'] },
        { model: UserCategoryInterest, as: 'categoryInterests', include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }] },
        { model: UserSubcategoryInterest, as: 'subcategoryInterests', include: [{ model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] }] },
        { model: UserSubsubCategoryInterest, as: 'subsubInterests', include: [{ model: SubsubCategory, as: 'subsubCategory', attributes: ['id', 'name'] }] },
        { model: UserIdentityInterest, as: 'identityInterests', include: [{ model: Identity, as: 'identity', attributes: ['id', 'name'] }] }
      ]
    });
    if (!user) return [];

    const userDefaults = {
      country: user.country || null,
      city: user.city || null,
      interestCategoryIds: (user.categoryInterests || []).map(i => i.categoryId).filter(Boolean),
      interestSubcategoryIds: (user.subcategoryInterests || []).map(i => i.subcategoryId).filter(Boolean),
      interestSubsubCategoryIds: (user.subsubInterests || []).map(i => i.subsubCategoryId).filter(Boolean),
      interestIdentityIds: (user.identityInterests || []).map(i => i.identityId).filter(Boolean),
      attributeCategoryIds: [],
      attributeSubcategoryIds: [],
      attributeSubsubCategoryIds: [],
      attributeIdentityIds: []
    };

    const attributeCats = (user.interests || []).map(i => i.categoryId).filter(Boolean);
    const attributeSubs = (user.interests || []).map(i => i.subcategoryId).filter(Boolean);
    if (user.profile?.categoryId) attributeCats.push(user.profile.categoryId);
    if (user.profile?.subcategoryId) attributeSubs.push(user.profile.subcategoryId);
    userDefaults.attributeCategoryIds = Array.from(new Set(attributeCats));
    userDefaults.attributeSubcategoryIds = Array.from(new Set(attributeSubs));

    const jobs = await Job.findAll({
      where: { createdAt: { [Op.gte]: since }, postedByUserId: { [Op.ne]: userId } },
      include: [
        { model: User, as: 'postedBy', attributes: ['id', 'name', 'avatarUrl'], include: [{ model: Profile, as: 'profile', attributes: ['avatarUrl'] }] },
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] },
        { model: SubsubCategory, as: 'subsubCategory', attributes: ['id', 'name'] },
        { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
        { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
        { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
        { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
      ],
      limit: 10
    });

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

    return scoredJobs.sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, 5);
  } catch (error) {
    console.error('Error getting job recommendations:', error);
    return [];
  }
}

// (Unchanged)
function calculateJobMatchPercentage(userDefaults, job) {
  const jobTaxonomies = {
    categories: [...(job.audienceCategories || []).map(c => String(c.id)), job.categoryId ? String(job.categoryId) : null].filter(Boolean),
    subcategories: [...(job.audienceSubcategories || []).map(s => String(s.id)), job.subcategoryId ? String(job.subcategoryId) : null].filter(Boolean),
    subsubcategories: [...(job.audienceSubsubs || []).map(s => String(s.id)), job.subsubCategoryId ? String(job.subsubCategoryId) : null].filter(Boolean),
    identities: (job.audienceIdentities || []).map(i => String(i.id)).filter(Boolean)
  };

  const interestCatSet = new Set(userDefaults.interestCategoryIds || []);
  const interestSubSet = new Set(userDefaults.interestSubcategoryIds || []);
  const interestXSet = new Set(userDefaults.interestSubsubCategoryIds || []);
  const interestIdSet = new Set(userDefaults.interestIdentityIds || []);
  const attrCatSet = new Set(userDefaults.attributeCategoryIds || []);
  const attrSubSet = new Set(userDefaults.attributeSubcategoryIds || []);

  const userCity = (userDefaults.city || '').toLowerCase();
  const userCountry = userDefaults.country || null;

  const WEIGHTS = { category: 25, subcategory: 30, subsubcategory: 20, identity: 15, location: 10 };

  let totalScore = 0;
  let matchedFactors = 0;

  if ((interestCatSet.size > 0 || attrCatSet.size > 0) && jobTaxonomies.categories.length > 0) {
    if (interestCatSet.size > 0) {
      const catMatches = jobTaxonomies.categories.filter(id => interestCatSet.has(id));
      if (catMatches.length > 0) {
        const catMatchPercentage = Math.min(1, catMatches.length / Math.max(interestCatSet.size, jobTaxonomies.categories.length));
        totalScore += WEIGHTS.category * catMatchPercentage * 1.5;
        matchedFactors++;
      }
    }
    if (attrCatSet.size > 0) {
      const catMatches = jobTaxonomies.categories.filter(id => attrCatSet.has(id));
      if (catMatches.length > 0) {
        const catMatchPercentage = Math.min(1, catMatches.length / Math.max(attrCatSet.size, jobTaxonomies.categories.length));
        totalScore += WEIGHTS.category * catMatchPercentage * 0.5;
        matchedFactors++;
      }
    }
  }

  if ((interestSubSet.size > 0 || attrSubSet.size > 0) && jobTaxonomies.subcategories.length > 0) {
    if (interestSubSet.size > 0) {
      const subMatches = jobTaxonomies.subcategories.filter(id => interestSubSet.has(id));
      if (subMatches.length > 0) {
        const subMatchPercentage = Math.min(1, subMatches.length / Math.max(interestSubSet.size, jobTaxonomies.subcategories.length));
        totalScore += WEIGHTS.subcategory * subMatchPercentage * 1.5;
        matchedFactors++;
      }
    }
    if (attrSubSet.size > 0) {
      const subMatches = jobTaxonomies.subcategories.filter(id => attrSubSet.has(id));
      if (subMatches.length > 0) {
        const subMatchPercentage = Math.min(1, subMatches.length / Math.max(attrSubSet.size, jobTaxonomies.subcategories.length));
        totalScore += WEIGHTS.subcategory * subMatchPercentage * 0.5;
        matchedFactors++;
      }
    }
  }

  const jobCity = (job.city || '').toLowerCase();
  const jobCountry = job.country || null;
  if (userCity && jobCity && userCity === jobCity) {
    totalScore += WEIGHTS.location * 0.8;
    matchedFactors++;
  } else if (userCity && jobCity && (jobCity.includes(userCity) || userCity.includes(jobCity))) {
    totalScore += WEIGHTS.location * 0.4;
    matchedFactors++;
  } else if (userCountry && jobCountry === userCountry) {
    totalScore += WEIGHTS.location * 0.5;
    matchedFactors++;
  }

  const REQUIRED_FACTORS = 3;
  if (matchedFactors < REQUIRED_FACTORS) {
    const scalingFactor = Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
    totalScore = totalScore * scalingFactor;
  }

  if (totalScore > 0) {
    const boostFactor = 1 + totalScore / 50;
    totalScore *= boostFactor;
  }

  const randomVariation = Math.random() * 5;
  totalScore += randomVariation;

  return Math.max(10, Math.min(100, Math.round(totalScore)));
}

/* ---------------- connection recommendations (UPDATED) ---------------- */
async function getConnectionRecommendations(userId) {
  try {
    // 1) Build viewer defaults exactly like people.controller
    const viewerDefaults = await getViewerDefaults(userId);

    // 2) Existing connections to exclude (and self)
    const connections = await Connection.findAll({
      where: { [Op.or]: [{ userOneId: userId }, { userTwoId: userId }] },
      attributes: ['userOneId', 'userTwoId']
    });

    const excludeIds = new Set([String(userId)]);
    connections.forEach(c => {
      excludeIds.add(String(c.userOneId === userId ? c.userTwoId : c.userOneId));
    });

    // 3) Candidate users (exclude admin + unverified + existing connections + self)
    const recommendedUsers = await User.findAll({
      where: {
        id: { [Op.notIn]: Array.from(excludeIds) },
        isVerified: true,
        accountType: { [Op.ne]: 'admin' }
      },
      include: [
        {
          model: UserCategory,
          as: 'interests',
          attributes: ['categoryId', 'subcategoryId'],
          include: [
            { model: Category, as: 'category', attributes: ['id', 'name'] },
            { model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] }
          ]
        },
        { model: Goal, as: 'goals', attributes: ['id', 'name'], through: { attributes: [] } },
        {
          model: Profile,
          as: 'profile',
          attributes: ['categoryId', 'subcategoryId', 'avatarUrl', 'professionalTitle', 'primaryIdentity']
        },
        { model: Category, as: 'categories', attributes: ['id', 'name'], through: { attributes: [] } },
        { model: Subcategory, as: 'subcategories', attributes: ['id', 'name'], through: { attributes: [] } }
      ],
      attributes: ['id', 'name', 'email', 'avatarUrl', 'biography', 'country', 'city'],
      limit: 50
    });

    // 4) Score with the SAME algorithm as people.controller (no boost/random)
    const scoredUsers = recommendedUsers.map(u => {
      const matchPercentage = calculateUserToUserMatchPercentage(
        viewerDefaults,
        u,
        [], // effAudienceCategoryIds not used for email recs
        []  // effAudienceSubcategoryIds not used for email recs
      );

      const categories = [
        ...(u.categories || []).map(c => c.name),
        ...(u.interests || []).filter(i => i.category).map(i => i.category.name)
      ];

      const subcategories = [
        ...(u.subcategories || []).map(s => s.name),
        ...(u.interests || []).filter(i => i.subcategory).map(i => i.subcategory.name)
      ];

      const uniqueCategories = [...new Set(categories)].filter(Boolean);
      const uniqueSubcategories = [...new Set(subcategories)].filter(Boolean);
      const goalNames = (u.goals || []).map(g => g.name).filter(Boolean);

      return {
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl || u.profile?.avatarUrl || null,
        biography: u.biography,
        professionalTitle: u.profile?.professionalTitle || '',
        primaryIdentity: u.profile?.primaryIdentity || '',
        categories: uniqueCategories,
        subcategories: uniqueSubcategories,
        goals: goalNames,
        location: [u.city, u.country].filter(Boolean).join(', '),
        link: `${process.env.BASE_URL || 'https://54links.com'}/profile/${u.id}`,
        matchPercentage
      };
    });

    // 5) Sort by matchPercentage DESC (then recent users)
    const top = scoredUsers
      .sort((a, b) => (b.matchPercentage - a.matchPercentage) || 0)
      .slice(0, 5);

    return top;
  } catch (error) {
    console.error('Error getting connection recommendations:', error);
    return [];
  }
}

/* ------------------------ email orchestration ---------------------- */
async function sendNotificationEmails(frequency) {
  try {
    console.log(`Sending ${frequency} notification emails...`);

    const now = new Date();
    let since;
    switch (frequency) {
      case 'daily': since = new Date(now.setDate(now.getDate() - 1)); break;
      case 'weekly': since = new Date(now.setDate(now.getDate() - 7)); break;
      case 'monthly': since = new Date(now.setMonth(now.getMonth() - 1)); break;
      default: since = new Date(now.setDate(now.getDate() - 1));
    }

    const userSettings = await getUsersByFrequency(frequency);

    for (const setting of userSettings) {
      const user = setting.user;
      if (!user || !user.email) continue;

      const notifications = typeof setting.notifications === 'string'
        ? JSON.parse(setting.notifications)
        : setting.notifications;

      // Connection updates
      if (notifications?.connectionUpdates?.email) {
        const updates = await getConnectionUpdates(user.id, since);
        if (updates.length > 0) {
          const html = connectionUpdateHtml({
            name: user.name,
            frequency,
            updates,
            baseUrl: process.env.BASE_URL || 'https://54links.com'
          });
          await sendEmail({ to: user.email, subject: `Your ${frequency} connection updates`, html });
        }
      }

      // Connection recommendations (NOW aligned with people.controller)
      if (notifications?.connectionRecommendations?.email) {
        const recommendations = await getConnectionRecommendations(user.id);
        if (recommendations.length > 0) {
          const html = recommendationHtml({
            name: user.name,
            recommendations,
            baseUrl: process.env.BASE_URL || 'https://54links.com'
          });
          await sendEmail({ to: user.email, subject: 'People you may want to connect with', html });
        }
      }

      // Job opportunities
      if (notifications?.jobOpportunities?.email) {
        const jobs = await getJobRecommendations(user.id, since);
        if (jobs.length > 0) {
          const html = jobOpportunityHtml({
            name: user.name,
            jobs,
            baseUrl: process.env.BASE_URL || 'https://54links.com'
          });
          await sendEmail({ to: user.email, subject: 'Job opportunities for you', html });
        }
      }
    }

    console.log(`Finished sending ${frequency} notification emails`);
  } catch (error) {
    console.error(`Error sending ${frequency} notification emails:`, error);
  }
}

/* ----------------------------- cron jobs -------------------------- */
const dailyJob = new CronJob('0 6 * * *', () => { sendNotificationEmails('daily'); }, null, false, 'UTC');
const weeklyJob = new CronJob('0 6 * * 1', () => { sendNotificationEmails('weekly'); }, null, false, 'UTC');
const monthlyJob = new CronJob('0 6 1 * *', () => { sendNotificationEmails('monthly'); }, null, false, 'UTC');

function startNotificationCronJobs() {
  dailyJob.start();
  weeklyJob.start();
  monthlyJob.start();
  console.log('Notification email cron jobs started');
}

function stopNotificationCronJobs() {
  dailyJob.stop();
  weeklyJob.stop();
  monthlyJob.stop();
  console.log('Notification email cron jobs stopped');
}

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

async function sendEmail(options) {
  try {
    const { to, subject, html } = options;
    await transporter.sendMail({
      from: `"54Links Alert" <${process.env.EMAIL_FROM}>`,
      to, subject, html
    });
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

module.exports = {
  startNotificationCronJobs,
  stopNotificationCronJobs,
  runNotificationEmailsNow,
  sendNotificationEmails
};
