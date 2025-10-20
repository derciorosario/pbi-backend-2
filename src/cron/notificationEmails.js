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
  Goal,
  UserCategory,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest,
  UserSubcategory,
  UserSubsubCategory,
  ConnectionRequest,
  UserBlock,
  Need,
  Moment
} = require('../models');
const { Op, Sequelize } = require('sequelize');
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
  host: process.env.EMAIL_HOST || 'mail.54links.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'updates-noreply@54links.com',
    pass: process.env.EMAIL_PASSWORD || '54Linka3002B'
  },
  tls: {
    rejectUnauthorized: false
  }
});

/* ----------------------------- utils ------------------------------ */
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [val];
}

// Load identity catalog for taxonomy validation (from feed controller)
let identityCatalog;
async function loadIdentityCatalog() {
  try {
    const { getIdentityCatalogFunc } = require('../utils/identity_taxonomy');
    identityCatalog = await getIdentityCatalogFunc('all');
  } catch (error) {
    console.error('Error loading identity catalog:', error);
    identityCatalog = [];
  }
}

// Initialize identity catalog
loadIdentityCatalog();

// Taxonomy validation function (from feed controller)
function checkIfBelongs(type, itemId, identityIds) {
  if (!identityIds || identityIds.length === 0 || !itemId) {
    return false;
  }

  const searchId = String(itemId);

  for (const identity of identityCatalog) {
    if (!identityIds.includes(String(identity.id))) {
      continue;
    }

    if (identity.categories) {
      for (const category of identity.categories) {
        if (type === 'category' && String(category.id) === searchId) {
          return true;
        }

        if (category.subcategories) {
          for (const subcategory of category.subcategories) {
            if (type === 'subcategory' && String(subcategory.id) === searchId) {
              return true;
            }

            if (subcategory.subsubs) {
              for (const subsub of subcategory.subsubs) {
                if (type === 'subsubcategory' && String(subsub.id) === searchId) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }

  return false;
}

// Bidirectional matching functions (from people controller)
function calculateBidirectionalMatch(aToB, bToA) {
  const average = (aToB + bToA) / 2;
  return average;
}

function calculateReciprocalWeightedMatch(aToB, bToA, weightSelf = 0.7) {
  const weightOther = 1 - weightSelf;
  const userAPerceived = (aToB * weightSelf) + (bToA * weightOther);
  return userAPerceived;
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

// Get user's complete profile data for matching (from people controller)
async function getUserProfileData(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'country', 'city'],
    include: [
      { 
        model: UserSubcategory, 
        as: 'userSubcategories', 
        attributes: ['subcategoryId'],
        include: [{ model: Subcategory, as: 'subcategory', attributes: ['id'] }]
      },
      { model: UserCategory, as: 'interests', attributes: ['categoryId', 'subcategoryId'] },
      { model: Goal, as: 'goals', attributes: ['id'] },
      { model: Identity, as: 'identities', attributes: ['id'], through: { attributes: [] } },
      { model: UserIdentityInterest, as: 'identityInterests', attributes: ['identityId'], include: [{ model: Identity, as: 'identity', attributes: ['id'] }] },
      { model: UserCategoryInterest, as: 'categoryInterests', attributes: ['categoryId'], include: [{ model: Category, as: 'category', attributes: ['id'] }] },
      { model: UserSubcategoryInterest, as: 'subcategoryInterests', attributes: ['subcategoryId'], include: [{ model: Subcategory, as: 'subcategory', attributes: ['id'] }] },
      { model: UserSubsubCategoryInterest, as: 'subsubInterests', attributes: ['subsubCategoryId'], include: [{ model: SubsubCategory, as: 'subsubCategory', attributes: ['id'] }] },
      { model: UserSubsubCategory, as: 'userSubsubCategories', attributes: ['subsubCategoryId'], include: [{ model: SubsubCategory, as: 'subsubCategory', attributes: ['id'] }] },
    ],
  });
  
  if (!user) return null;
  
  const profileData = {
    myCountry: user.country || null,
    myCity: user.city || null,
    myCategoryIds: (user.interests || []).map((i) => String(i.categoryId)).filter(id => id && id !== 'null'),
    mySubcategoryIds: (user.userSubcategories || []).map((i) => String(i.subcategoryId)).filter(id => id && id !== 'null'),
    mySubsubCategoryIds: (user.userSubsubCategories || []).map((i) => String(i.subsubCategoryId)).filter(id => id && id !== 'null'),
    myGoalIds: (user.goals || []).map((g) => String(g.id)).filter(Boolean),
    myIdentities: (user.identities || []).map(i => i),
    myIdentityInterests: (user.identityInterests || []).map(i => i),
    myCategoryInterests: (user.categoryInterests || []).map(i => i),
    mySubcategoryInterests: (user.subcategoryInterests || []).map(i => i),
    mySubsubCategoryInterests: (user.subsubInterests || []).map(i => i),
  };
  
  return profileData;
}

// Calculate match percentage for connection updates (based on feed controller)
function calculateConnectionUpdateMatchPercentage(userProfile, item) {
  if (!userProfile) return 50; // Default score if no user profile
  
  const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
  let totalScore = 0;
  let totalPossibleScore = 0;

  // Get user's interests (what they're looking for)
  const userInterests = {
    categories: userProfile.myCategoryInterests.map(i => String(i.categoryId)).filter(id => checkIfBelongs('category', id, userProfile.myIdentities.map(id => String(id.id)))),
    subcategories: userProfile.mySubcategoryInterests.map(i => String(i.subcategoryId)).filter(id => checkIfBelongs('subcategory', id, userProfile.myIdentities.map(id => String(id.id)))),
    subsubcategories: userProfile.mySubsubCategoryInterests.map(i => String(i.subsubCategoryId)).filter(id => checkIfBelongs('subsubcategory', id, userProfile.myIdentities.map(id => String(id.id)))),
    identities: userProfile.myIdentityInterests.map(i => String(i.identityId)),
  };

  // Get item's offerings (what it provides)
  const itemOfferings = {
    categories: (item.audienceCategories || []).map((c) => String(c.id)),
    subcategories: (item.audienceSubcategories || []).map((s) => String(s.id)),
    subsubcategories: (item.audienceSubsubs || []).map((s) => String(s.id)),
    identities: (item.audienceIdentities || []).map((i) => String(i.id)),
  };

  // Identity matching
  if (userInterests.identities.length > 0) {
    const hasMatch = itemOfferings.identities.length > 0 && 
      itemOfferings.identities.some(id => userInterests.identities.includes(id));
    if (hasMatch) {
      totalScore += WEIGHTS.identity;
    }
    totalPossibleScore += WEIGHTS.identity;
  }

  // Category matching
  if (userInterests.categories.length > 0) {
    const targetMatches = itemOfferings.categories.filter(id => userInterests.categories.includes(id));
    const pct = Math.min(1, targetMatches.length / Math.max(userInterests.categories.length, itemOfferings.categories.length));
    totalScore += WEIGHTS.category * pct;
    totalPossibleScore += WEIGHTS.category;
  }

  // Subcategory matching
  if (userInterests.subcategories.length > 0) {
    const targetMatches = itemOfferings.subcategories.filter(id => userInterests.subcategories.includes(id));
    const pct = Math.min(1, targetMatches.length / Math.max(userInterests.subcategories.length, itemOfferings.subcategories.length));
    totalScore += WEIGHTS.subcategory * pct;
    totalPossibleScore += WEIGHTS.subcategory;
  }

  // Subsubcategory matching
  if (userInterests.subsubcategories.length > 0) {
    const targetMatches = itemOfferings.subsubcategories.filter(id => userInterests.subsubcategories.includes(id));
    const pct = Math.min(1, targetMatches.length / Math.max(userInterests.subsubcategories.length, itemOfferings.subsubcategories.length));
    totalScore += WEIGHTS.subsubcategory * pct;
    totalPossibleScore += WEIGHTS.subsubcategory;
  }

  // Location matching
  const itemCity = (item.city || item.location || "").toLowerCase();
  let locationScore = 0;
  if (userProfile.myCity && itemCity && itemCity === userProfile.myCity.toLowerCase()) {
    locationScore = 10 * 0.6;
    totalScore += locationScore;
    totalPossibleScore += 10;
  } else if (userProfile.myCountry && item.country === userProfile.myCountry) {
    locationScore = 10 * 0.4;
    totalScore += locationScore;
    totalPossibleScore += 10;
  }

  if (totalPossibleScore === 0) return 50;
  
  const percentage = Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100)));
  return percentage;
}

async function getConnectionUpdates(userId, since) {
  try {
    // Get user's profile data for matching
    const userProfile = await getUserProfileData(userId);
    
    // Get user's connections (both sides)
    const connections = await Connection.findAll({
      where: { [Op.or]: [{ userOneId: userId }, { userTwoId: userId }] },
      attributes: ['userOneId', 'userTwoId']
    });

    const connectedUserIds = connections.map(c =>
      c.userOneId === userId ? c.userTwoId : c.userOneId
    );

    if (connectedUserIds.length === 0) return [];


    // Fetch newest content from connected users with audience data
    const [events, services, products, tourismPosts, fundingPosts, moments, needs] = await Promise.all([
      Event.findAll({
        where: {
          organizerUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'organizer', attributes: ['id', 'name', 'avatarUrl'] },
          { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      }),

      Service.findAll({
        where: {
          providerUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'provider', attributes: ['id', 'name', 'avatarUrl'] },
          { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      }),

      Product.findAll({
        where: {
          sellerUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'seller', attributes: ['id', 'name', 'avatarUrl'] },
          { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      }),

      Tourism.findAll({
        where: {
          authorUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since }
        },
        include: [
          { model: User, as: 'author', attributes: ['id', 'name', 'avatarUrl'] },
          { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      }),

      Funding.findAll({
        where: {
          creatorUserId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since },
          status: { [Op.ne]: 'draft' }
        },
        include: [
          { model: User, as: 'creator', attributes: ['id', 'name', 'avatarUrl'] },
          { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      }),
         // Moments from connected users
      Moment.findAll({
        where: {
          userId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since },
          moderation_status: 'approved'
        },
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'avatarUrl'] },
          // Include category associations for moments
          { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      }),

      // Needs from connected users
      Need.findAll({
        where: {
          userId: { [Op.in]: connectedUserIds },
          createdAt: { [Op.gte]: since },
          moderation_status: 'approved'
        },
        include: [
          { model: User, as: 'user', attributes: ['id', 'name', 'avatarUrl'] },
          // Include category associations for needs
          { model: Category, as: 'audienceCategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Subcategory, as: 'audienceSubcategories', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: SubsubCategory, as: 'audienceSubsubs', attributes: ['id', 'name'], through: { attributes: [] } },
          { model: Identity, as: 'audienceIdentities', attributes: ['id', 'name'], through: { attributes: [] } }
        ]
      })
     ]);
    
      
    // Normalize to common shape with match percentages

    const updates = [
      ...events.map(e => ({
        type: 'event',
        title: e.title,
        description: e.description,
        createdByName: e.organizer.name,
        createdAt: e.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/event/${e.id}`,
        matchPercentage: calculateConnectionUpdateMatchPercentage(userProfile, e)
      })),
      ...services.map(s => ({
        type: 'service',
        title: s.title,
        description: s.description,
        createdByName: s.provider.name,
        createdAt: s.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/service/${s.id}`,
        matchPercentage: calculateConnectionUpdateMatchPercentage(userProfile, s)
      })),
      ...products.map(p => ({
        type: 'product',
        title: p.title,
        description: p.description,
        createdByName: p.seller.name,
        createdAt: p.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/product/${p.id}`,
        matchPercentage: calculateConnectionUpdateMatchPercentage(userProfile, p)
      })),
      ...tourismPosts.map(t => ({
        type: 'tourism Activity',
        title: t.title,
        description: t.description,
        createdByName: t.author.name,
        createdAt: t.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/experience/${t.id}`,
        matchPercentage: calculateConnectionUpdateMatchPercentage(userProfile, t)
      })),
      ...fundingPosts.map(f => ({
        type: 'funding investment',
        title: f.title,
        description: f.pitch,
        createdByName: f.creator.name,
        createdAt: f.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/funding/${f.id}`,
        matchPercentage: calculateConnectionUpdateMatchPercentage(userProfile, f)
      })),
        ...moments.map(m => ({
        type: 'experience',
        title: m.title,
        description: m.description,
        createdByName: m.user.name,
        createdAt: m.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/moment/${m.id}`,
        matchPercentage: calculateConnectionUpdateMatchPercentage(userProfile, m)
      })),
      ...needs.map(n => ({
        type: 'interest / question',
        title: n.title,
        description: n.description,
        createdByName: n.user.name,
        createdAt: n.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/need/${n.id}`,
        matchPercentage: calculateConnectionUpdateMatchPercentage(userProfile, n)
      }))
    ];

    // Sort by match percentage then recency
    return updates.sort((a, b) => {
      if (b.matchPercentage !== a.matchPercentage) return b.matchPercentage - a.matchPercentage;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).filter(i=>i.matchPercentage).slice(0,10);

  } catch (error) {
    console.error('Error getting connection updates:', error);
    return [];
  }
}

/* ----------------------- job recommendations ---------------------- */
// Calculate job match percentage based on feed controller logic
function calculateJobMatchPercentage(userProfile, job) {
  if (!userProfile) return 50;

  const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
  let totalScore = 0;
  let totalPossibleScore = 0;

  // Get user's interests (what they're looking for)
  const userInterests = {
    categories: userProfile.myCategoryInterests.map(i => String(i.categoryId)).filter(id => checkIfBelongs('category', id, userProfile.myIdentities.map(id => String(id.id)))),
    subcategories: userProfile.mySubcategoryInterests.map(i => String(i.subcategoryId)).filter(id => checkIfBelongs('subcategory', id, userProfile.myIdentities.map(id => String(id.id)))),
    subsubcategories: userProfile.mySubsubCategoryInterests.map(i => String(i.subsubCategoryId)).filter(id => checkIfBelongs('subsubcategory', id, userProfile.myIdentities.map(id => String(id.id)))),
    identities: userProfile.myIdentityInterests.map(i => String(i.identityId)),
  };

  // Get job's offerings
  const jobOfferings = {
    categories: [...(job.audienceCategories || []).map(c => String(c.id)), job.categoryId ? String(job.categoryId) : null].filter(Boolean),
    subcategories: [...(job.audienceSubcategories || []).map(s => String(s.id)), job.subcategoryId ? String(job.subcategoryId) : null].filter(Boolean),
    subsubcategories: [...(job.audienceSubsubs || []).map(s => String(s.id)), job.subsubCategoryId ? String(job.subsubCategoryId) : null].filter(Boolean),
    identities: (job.audienceIdentities || []).map(i => String(i.id)).filter(Boolean),
  };

  // Identity matching
  if (userInterests.identities.length > 0) {
    const hasMatch = jobOfferings.identities.length > 0 && 
      jobOfferings.identities.some(id => userInterests.identities.includes(id));
    if (hasMatch) {
      totalScore += WEIGHTS.identity;
    }
    totalPossibleScore += WEIGHTS.identity;
  }

  // Category matching
  if (userInterests.categories.length > 0) {
    const targetMatches = jobOfferings.categories.filter(id => userInterests.categories.includes(id));
    const pct = Math.min(1, targetMatches.length / Math.max(userInterests.categories.length, jobOfferings.categories.length));
    totalScore += WEIGHTS.category * pct;
    totalPossibleScore += WEIGHTS.category;
  }

  // Subcategory matching
  if (userInterests.subcategories.length > 0) {
    const targetMatches = jobOfferings.subcategories.filter(id => userInterests.subcategories.includes(id));
    const pct = Math.min(1, targetMatches.length / Math.max(userInterests.subcategories.length, jobOfferings.subcategories.length));
    totalScore += WEIGHTS.subcategory * pct;
    totalPossibleScore += WEIGHTS.subcategory;
  }

  // Subsubcategory matching
  if (userInterests.subsubcategories.length > 0) {
    const targetMatches = jobOfferings.subsubcategories.filter(id => userInterests.subsubcategories.includes(id));
    const pct = Math.min(1, targetMatches.length / Math.max(userInterests.subsubcategories.length, jobOfferings.subsubcategories.length));
    totalScore += WEIGHTS.subsubcategory * pct;
    totalPossibleScore += WEIGHTS.subsubcategory;
  }

  // Location matching
  const jobCity = (job.city || "").toLowerCase();
  let locationScore = 0;
  if (userProfile.myCity && jobCity && jobCity === userProfile.myCity.toLowerCase()) {
    locationScore = 10 * 0.6;
    totalScore += locationScore;
    totalPossibleScore += 10;
  } else if (userProfile.myCountry && job.country === userProfile.myCountry) {
    locationScore = 10 * 0.4;
    totalScore += locationScore;
    totalPossibleScore += 10;
  }

  if (totalPossibleScore === 0) return 50;
  
  const percentage = Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100)));
  return percentage;
}



async function getJobRecommendations(userId, since) {
  try {
    const userProfile = await getUserProfileData(userId);
    if (!userProfile) return [];

    const jobs = await Job.findAll({
      where: { 
        createdAt: { [Op.gte]: since }, 
        postedByUserId: { [Op.ne]: userId },
        moderation_status: 'approved'
      },
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
      limit: 20
    });

    const scoredJobs = jobs.map(job => {
      const matchPercentage = calculateJobMatchPercentage(userProfile, job);
      return {
        id: job.id,
        title: job.title,
        company: job.companyName,
        location: job.city ? `${job.city}, ${job.country}` : job.country,
        description: job.description,
        createdByName:job.postedBy.name,
        createdByAvatarUrl:job.postedBy.avatarUrl,
        createdBy: job.postedBy,
        createdAt: job.createdAt,
        link: `${process.env.BASE_URL || 'https://54links.com'}/jobs/${job.id}`,
        matchPercentage
      };
    });
    return scoredJobs.sort((a, b) => b.matchPercentage - a.matchPercentage).filter(i=>i.matchPercentage).slice(0, 5);
  } catch (error) {
    console.error('Error getting job recommendations:', error);
    return [];
  }
}

/* ---------------- connection recommendations (BIDIRECTIONAL) ---------------- */
// Calculate bidirectional match percentage based on people controller
/*function calculateBidirectionalConnectionMatch(currentUserProfile, targetUser, useBidirectionalMatch = true, bidirectionalMatchFormula = "reciprocal") {
  if (!currentUserProfile) return 50;

  // Direction 1: Current user wants -> Target user does
  const currentUserIdentityInterests = new Set(currentUserProfile.myIdentityInterests.map(i => String(i.identityId)));
  const currentUserCategoryInterests = new Set(currentUserProfile.myCategoryInterests.map(i => String(i.categoryId)));
  const currentUserSubcategoryInterests = new Set(currentUserProfile.mySubcategoryInterests.map(i => String(i.subcategoryId)));
  const currentUserSubsubCategoryInterests = new Set(currentUserProfile.mySubsubCategoryInterests.map(i => String(i.subsubCategoryId)));

  const targetUserIdentities = new Set((targetUser.identities || []).map(i => String(i.id)));
  const targetUserCategories = new Set((targetUser.interests || []).map(i => String(i.categoryId)));
  const targetUserSubcategories = new Set((targetUser.userSubcategories || []).map(i => String(i.subcategoryId)));
  const targetUserSubsubcategories = new Set((targetUser.userSubsubCategories || []).map(i => String(i.subsubCategoryId)));

  const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
  let totalScore = 0;
  let totalPossibleScore = 0;

  // Direction 1 matching
  if (currentUserIdentityInterests.size > 0) {
    const targetUserMatches = new Set([...currentUserIdentityInterests].filter(x => targetUserIdentities.has(x)));
    const matchValue = targetUserMatches.size > 0 ? 1 : 0;
    totalScore += WEIGHTS.identity * matchValue;
    totalPossibleScore += WEIGHTS.identity;
  }

  if (currentUserCategoryInterests.size > 0) {
    const targetUserMatches = new Set([...currentUserCategoryInterests].filter(x => targetUserCategories.has(x)));
    const matchValue = targetUserMatches.size / currentUserCategoryInterests.size;
    totalScore += WEIGHTS.category * matchValue;
    totalPossibleScore += WEIGHTS.category;
  }

  if (currentUserSubcategoryInterests.size > 0) {
    const targetUserMatches = new Set([...currentUserSubcategoryInterests].filter(x => targetUserSubcategories.has(x)));
    const matchValue = targetUserMatches.size / currentUserSubcategoryInterests.size;
    totalScore += WEIGHTS.subcategory * matchValue;
    totalPossibleScore += WEIGHTS.subcategory;
  }

  if (currentUserSubsubCategoryInterests.size > 0) {
    const targetUserMatches = new Set([...currentUserSubsubCategoryInterests].filter(x => targetUserSubsubcategories.has(x)));
    const matchValue = targetUserMatches.size / currentUserSubsubCategoryInterests.size;
    totalScore += WEIGHTS.subsubcategory * matchValue;
    totalPossibleScore += WEIGHTS.subsubcategory;
  }

  const unidirectionalPercentage = totalPossibleScore > 0 ? 
    Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100))) : 0;

  if (!useBidirectionalMatch) {
    return unidirectionalPercentage;
  }

  // Direction 2: Target user wants -> Current user does
  const targetUserIdentityInterests = new Set((targetUser.identityInterests || []).map(i => String(i.identityId)));
  const targetUserCategoryInterests = new Set((targetUser.categoryInterests || []).map(i => String(i.categoryId)));
  const targetUserSubcategoryInterests = new Set((targetUser.subcategoryInterests || []).map(i => String(i.subcategoryId)));
  const targetUserSubsubCategoryInterests = new Set((targetUser.subsubInterests || []).map(i => String(i.subsubCategoryId)));

  const currentUserIdentities = new Set(currentUserProfile.myIdentities.map(i => String(i.id)));
  const currentUserCategories = new Set(currentUserProfile.myCategoryIds);
  const currentUserSubcategories = new Set(currentUserProfile.mySubcategoryIds);
  const currentUserSubsubcategories = new Set(currentUserProfile.mySubsubCategoryIds);

  let reverseTotalScore = 0;
  let reverseTotalPossibleScore = 0;

  if (targetUserIdentityInterests.size > 0) {
    const currentUserMatches = new Set([...targetUserIdentityInterests].filter(x => currentUserIdentities.has(x)));
    const matchValue = currentUserMatches.size > 0 ? 1 : 0;
    reverseTotalScore += WEIGHTS.identity * matchValue;
    reverseTotalPossibleScore += WEIGHTS.identity;
  }

  if (targetUserCategoryInterests.size > 0) {
    const currentUserMatches = new Set([...targetUserCategoryInterests].filter(x => currentUserCategories.has(x)));
    const matchValue = currentUserMatches.size / targetUserCategoryInterests.size;
    reverseTotalScore += WEIGHTS.category * matchValue;
    reverseTotalPossibleScore += WEIGHTS.category;
  }

  if (targetUserSubcategoryInterests.size > 0) {
    const currentUserMatches = new Set([...targetUserSubcategoryInterests].filter(x => currentUserSubcategories.has(x)));
    const matchValue = currentUserMatches.size / targetUserSubcategoryInterests.size;
    reverseTotalScore += WEIGHTS.subcategory * matchValue;
    reverseTotalPossibleScore += WEIGHTS.subcategory;
  }

  if (targetUserSubsubCategoryInterests.size > 0) {
    const currentUserMatches = new Set([...targetUserSubsubCategoryInterests].filter(x => currentUserSubsubcategories.has(x)));
    const matchValue = currentUserMatches.size / targetUserSubsubCategoryInterests.size;
    reverseTotalScore += WEIGHTS.subsubcategory * matchValue;
    reverseTotalPossibleScore += WEIGHTS.subsubcategory;
  }

  const reversePercentage = reverseTotalPossibleScore > 0 ? 
    Math.max(0, Math.min(100, Math.round((reverseTotalScore / reverseTotalPossibleScore) * 100))) : 0;

  // Calculate bidirectional percentage
  let bidirectionalPercentage;
  if (bidirectionalMatchFormula === "simple") {
    bidirectionalPercentage = calculateBidirectionalMatch(unidirectionalPercentage, reversePercentage);
  } else {
    bidirectionalPercentage = calculateReciprocalWeightedMatch(unidirectionalPercentage, reversePercentage);
  }

  return Math.round(bidirectionalPercentage);
}
  */


/* ---------------- connection recommendations (BIDIRECTIONAL) ---------------- */
// Calculate bidirectional match percentage based on people controller
function calculateBidirectionalConnectionMatch(currentUserProfile, targetUser, useBidirectionalMatch = true, bidirectionalMatchFormula = "reciprocal") {
  if (!currentUserProfile) return 50;

  // Direction 1: Current user wants -> Target user does
  const currentUserIdentityInterests = new Set(currentUserProfile.myIdentityInterests.map(i => String(i.identityId)));
  const currentUserCategoryInterests = new Set(currentUserProfile.myCategoryInterests.map(i => String(i.categoryId)));
  const currentUserSubcategoryInterests = new Set(currentUserProfile.mySubcategoryInterests.map(i => String(i.subcategoryId)));
  const currentUserSubsubCategoryInterests = new Set(currentUserProfile.mySubsubCategoryInterests.map(i => String(i.subsubCategoryId)));

  const targetUserIdentities = new Set((targetUser.identities || []).map(i => String(i.id)));
  const targetUserCategories = new Set((targetUser.interests || []).map(i => String(i.categoryId)));
  const targetUserSubcategories = new Set((targetUser.userSubcategories || []).map(i => String(i.subcategoryId)));
  const targetUserSubsubcategories = new Set((targetUser.userSubsubCategories || []).map(i => String(i.subsubCategoryId)));

  const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
  let totalScore = 0;
  let totalPossibleScore = 0;

  // Track which levels are actually applicable (have valid interests)
  const applicableLevels = {
    identity: currentUserIdentityInterests.size > 0,
    category: false,
    subcategory: false,
    subsubcategory: false
  };

  // Direction 1 matching with taxonomy validation
  // 1. Identity matching - 100% if at least one match found
  if (currentUserIdentityInterests.size > 0) {
    const targetUserMatches = new Set([...currentUserIdentityInterests].filter(x => targetUserIdentities.has(x)));
    const matchValue = targetUserMatches.size > 0 ? 1 : 0;
    totalScore += WEIGHTS.identity * matchValue;
    totalPossibleScore += WEIGHTS.identity;
  }

  // 2. Category matching - ONLY consider categories that belong to target user's identities
  if (currentUserCategoryInterests.size > 0) {
    // Filter current user's category interests to only include those valid for target user's identities
    const validCurrentUserCategoryInterests = new Set(
      [...currentUserCategoryInterests].filter(catId => 
        checkIfBelongs('category', catId, [...targetUserIdentities])
      )
    );
    
    if (validCurrentUserCategoryInterests.size > 0) {
      applicableLevels.category = true;
      
      // Also filter target user's categories to only include valid ones
      const validTargetUserCategories = new Set(
        [...targetUserCategories].filter(catId =>
          checkIfBelongs('category', catId, [...targetUserIdentities])
        )
      );
      
      const targetUserMatches = new Set([...validCurrentUserCategoryInterests].filter(x => validTargetUserCategories.has(x)));
      const matchValue = targetUserMatches.size / validCurrentUserCategoryInterests.size;
      totalScore += WEIGHTS.category * matchValue;
      totalPossibleScore += WEIGHTS.category;
    }
  }

  // 3. Subcategory matching - ONLY consider subcategories that belong to target user's identities
  if (currentUserSubcategoryInterests.size > 0) {
    // Filter current user's subcategory interests to only include those valid for target user's identities
    const validCurrentUserSubcategoryInterests = new Set(
      [...currentUserSubcategoryInterests].filter(subId => 
        checkIfBelongs('subcategory', subId, [...targetUserIdentities])
      )
    );
    
    if (validCurrentUserSubcategoryInterests.size > 0) {
      applicableLevels.subcategory = true;
      
      // Also filter target user's subcategories to only include valid ones
      const validTargetUserSubcategories = new Set(
        [...targetUserSubcategories].filter(subId =>
          checkIfBelongs('subcategory', subId, [...targetUserIdentities])
        )
      );
      
      const targetUserMatches = new Set([...validCurrentUserSubcategoryInterests].filter(x => validTargetUserSubcategories.has(x)));
      const matchValue = targetUserMatches.size / validCurrentUserSubcategoryInterests.size;
      totalScore += WEIGHTS.subcategory * matchValue;
      totalPossibleScore += WEIGHTS.subcategory;
    }
  }

  // 4. Subsubcategory matching - ONLY consider subsubcategories that belong to target user's identities
  if (currentUserSubsubCategoryInterests.size > 0) {
    // Filter current user's subsubcategory interests to only include those valid for target user's identities
    const validCurrentUserSubsubCategoryInterests = new Set(
      [...currentUserSubsubCategoryInterests].filter(subsubId => 
        checkIfBelongs('subsubcategory', subsubId, [...targetUserIdentities])
      )
    );
    
    if (validCurrentUserSubsubCategoryInterests.size > 0) {
      applicableLevels.subsubcategory = true;
      
      // Also filter target user's subsubcategories to only include valid ones
      const validTargetUserSubsubcategories = new Set(
        [...targetUserSubsubcategories].filter(subsubId =>
          checkIfBelongs('subsubcategory', subsubId, [...targetUserIdentities])
        )
      );
      
      const targetUserMatches = new Set([...validCurrentUserSubsubCategoryInterests].filter(x => validTargetUserSubsubcategories.has(x)));
      const matchValue = targetUserMatches.size / validCurrentUserSubsubCategoryInterests.size;
      totalScore += WEIGHTS.subsubcategory * matchValue;
      totalPossibleScore += WEIGHTS.subsubcategory;
    }
  }

  const unidirectionalPercentage = totalPossibleScore > 0 ? 
    Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100))) : 0;

  if (!useBidirectionalMatch) {
    return unidirectionalPercentage;
  }

  // Direction 2: Target user wants -> Current user does
  const targetUserIdentityInterests = new Set((targetUser.identityInterests || []).map(i => String(i.identityId)));
  const targetUserCategoryInterests = new Set((targetUser.categoryInterests || []).map(i => String(i.categoryId)));
  const targetUserSubcategoryInterests = new Set((targetUser.subcategoryInterests || []).map(i => String(i.subcategoryId)));
  const targetUserSubsubCategoryInterests = new Set((targetUser.subsubInterests || []).map(i => String(i.subsubCategoryId)));

  const currentUserIdentities = new Set(currentUserProfile.myIdentities.map(i => String(i.id)));
  const currentUserCategories = new Set(currentUserProfile.myCategoryIds);
  const currentUserSubcategories = new Set(currentUserProfile.mySubcategoryIds);
  const currentUserSubsubcategories = new Set(currentUserProfile.mySubsubCategoryIds);

  let reverseTotalScore = 0;
  let reverseTotalPossibleScore = 0;

  // Track which levels are applicable for reverse matching
  const reverseApplicableLevels = {
    identity: targetUserIdentityInterests.size > 0,
    category: false,
    subcategory: false,
    subsubcategory: false
  };

  // Direction 2 matching with taxonomy validation
  // 1. Identity matching - 100% if at least one match found
  if (targetUserIdentityInterests.size > 0) {
    const currentUserMatches = new Set([...targetUserIdentityInterests].filter(x => currentUserIdentities.has(x)));
    const matchValue = currentUserMatches.size > 0 ? 1 : 0;
    reverseTotalScore += WEIGHTS.identity * matchValue;
    reverseTotalPossibleScore += WEIGHTS.identity;
  }

  // 2. Category matching with taxonomy validation
  if (targetUserCategoryInterests.size > 0) {
    // Filter target user's category interests to only include those valid for current user's identities
    const validTargetUserCategoryInterests = new Set(
      [...targetUserCategoryInterests].filter(catId => 
        checkIfBelongs('category', catId, [...currentUserIdentities])
      )
    );
    
    if (validTargetUserCategoryInterests.size > 0) {
      reverseApplicableLevels.category = true;
      
      // Use all current user categories (don't filter offerings)
      const currentUserMatches = new Set([...validTargetUserCategoryInterests].filter(x => currentUserCategories.has(x)));
      const matchValue = currentUserMatches.size / validTargetUserCategoryInterests.size;
      reverseTotalScore += WEIGHTS.category * matchValue;
      reverseTotalPossibleScore += WEIGHTS.category;
    }
  }

  // 3. Subcategory matching with taxonomy validation
  if (targetUserSubcategoryInterests.size > 0) {
    // Filter target user's subcategory interests to only include those valid for current user's identities
    const validTargetUserSubcategoryInterests = new Set(
      [...targetUserSubcategoryInterests].filter(subId => 
        checkIfBelongs('subcategory', subId, [...currentUserIdentities])
      )
    );
    
    if (validTargetUserSubcategoryInterests.size > 0) {
      reverseApplicableLevels.subcategory = true;
      
      // Use all current user subcategories (don't filter offerings)
      const currentUserMatches = new Set([...validTargetUserSubcategoryInterests].filter(x => currentUserSubcategories.has(x)));
      const matchValue = currentUserMatches.size / validTargetUserSubcategoryInterests.size;
      reverseTotalScore += WEIGHTS.subcategory * matchValue;
      reverseTotalPossibleScore += WEIGHTS.subcategory;
    }
  }

  // 4. Subsubcategory matching with taxonomy validation
  if (targetUserSubsubCategoryInterests.size > 0) {
    // Filter target user's subsubcategory interests to only include those valid for current user's identities
    const validTargetUserSubsubCategoryInterests = new Set(
      [...targetUserSubsubCategoryInterests].filter(subsubId => 
        checkIfBelongs('subsubcategory', subsubId, [...currentUserIdentities])
      )
    );
    
    if (validTargetUserSubsubCategoryInterests.size > 0) {
      reverseApplicableLevels.subsubcategory = true;
      
      // Use all current user subsubcategories (don't filter offerings)
      const currentUserMatches = new Set([...validTargetUserSubsubCategoryInterests].filter(x => currentUserSubsubcategories.has(x)));
      const matchValue = currentUserMatches.size / validTargetUserSubsubCategoryInterests.size;
      reverseTotalScore += WEIGHTS.subsubcategory * matchValue;
      reverseTotalPossibleScore += WEIGHTS.subsubcategory;
    }
  }

  const reversePercentage = reverseTotalPossibleScore > 0 ? 
    Math.max(0, Math.min(100, Math.round((reverseTotalScore / reverseTotalPossibleScore) * 100))) : 0;

  // Calculate bidirectional percentage
  let bidirectionalPercentage;
  if (bidirectionalMatchFormula === "simple") {
    bidirectionalPercentage = calculateBidirectionalMatch(unidirectionalPercentage, reversePercentage);
  } else {
    bidirectionalPercentage = calculateReciprocalWeightedMatch(unidirectionalPercentage, reversePercentage);
  }

  return Math.round(bidirectionalPercentage);
}

async function getConnectionRecommendations(userId) {
  try {
    const currentUserProfile = await getUserProfileData(userId);
    if (!currentUserProfile) return [];

    // Get user settings for matching configuration
    const userSettings = await UserSettings.findOne({
      where: { userId },
      attributes: ['bidirectionalMatch', 'bidirectionalMatchFormula']
    });

    const useBidirectionalMatch = userSettings?.bidirectionalMatch !== false;
    const bidirectionalMatchFormula = userSettings?.bidirectionalMatchFormula || "reciprocal";

    // Existing connections to exclude
    const connections = await Connection.findAll({
      where: { [Op.or]: [{ userOneId: userId }, { userTwoId: userId }] },
      attributes: ['userOneId', 'userTwoId']
    });

    const excludeIds = new Set([String(userId)]);
    connections.forEach(c => {
      excludeIds.add(String(c.userOneId === userId ? c.userTwoId : c.userOneId));
    });

    // Get blocked users
    const [iBlock, theyBlock] = await Promise.all([
      UserBlock.findAll({ where: { blockerId: userId }, attributes: ["blockedId"] }),
      UserBlock.findAll({ where: { blockedId: userId }, attributes: ["blockerId"] }),
    ]);
    
    const blockedIds = [
      ...iBlock.map((r) => String(r.blockedId)),
      ...theyBlock.map((r) => String(r.blockerId)),
    ];
    
    blockedIds.forEach(id => excludeIds.add(id));

    // Candidate users
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
        { model: UserSubcategory, as: 'userSubcategories', include: [{ model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] }] },
        { model: UserSubsubCategory, as: 'userSubsubCategories', include: [{ model: SubsubCategory, as: 'subsubCategory', attributes: ['id', 'name'] }] },
        { model: UserIdentityInterest, as: 'identityInterests', include: [{ model: Identity, as: 'identity', attributes: ['id', 'name'] }] },
        { model: UserCategoryInterest, as: 'categoryInterests', include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }] },
        { model: UserSubcategoryInterest, as: 'subcategoryInterests', include: [{ model: Subcategory, as: 'subcategory', attributes: ['id', 'name'] }] },
        { model: UserSubsubCategoryInterest, as: 'subsubInterests', include: [{ model: SubsubCategory, as: 'subsubCategory', attributes: ['id', 'name'] }] },
        { model: Identity, as: 'identities', attributes: ['id', 'name'], through: { attributes: [] } }
      ],
      attributes: ['id', 'name', 'email', 'avatarUrl', 'biography', 'country', 'city'],
      limit: 100
    });

    // Score with bidirectional matching
    const scoredUsers = recommendedUsers.map(u => {
      const matchPercentage = calculateBidirectionalConnectionMatch(
        currentUserProfile, 
        u, 
        useBidirectionalMatch,
        bidirectionalMatchFormula
      );

      const categories = [
        ...(u.interests || []).filter(i => i.category).map(i => i.category.name)
      ];

      const subcategories = [
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

    // Sort by match percentage
    const top = scoredUsers
      .sort((a, b) => (b.matchPercentage - a.matchPercentage) || 0).filter(i=>i.matchPercentage)
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

      // Connection updates (feed-based matching)
      if (notifications?.connectionUpdates?.email) {
        const updates = await getConnectionUpdates(user.id, since);
        console.log({since})
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

      // Connection recommendations (people-based bidirectional matching)
      if (notifications?.connectionRecommendations?.email) {
        const recommendations = await getConnectionRecommendations(user.id);
        if (recommendations.length > 0) {
          const html = recommendationHtml({
            name: user.name,
            recommendations,
            total:recommendations.length,
            baseUrl: process.env.BASE_URL || 'https://54links.com'
          });
          await sendEmail({ to: user.email, subject: 'People you may want to connect with', html });
        }
      }

      // Job opportunities (feed-based matching)
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