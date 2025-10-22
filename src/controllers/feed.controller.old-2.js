// src/controllers/feed.controller.js
const { Op, Sequelize } = require("sequelize");
const {
  Job,
  Event,
  Need,
  Moment,
  Category,
  Subcategory,
  User,
  Profile,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  Goal,
  Connection,
  ConnectionRequest,
  Identity,
  Service,
  Product,
  Tourism,
  Funding,
  SubsubCategory,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest,
  UserIdentity,
  UserBlock,
  GeneralCategory,
  GeneralSubcategory,
  GeneralSubsubCategory,
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
  UserSettings,
  EventCategory,
  EventSubcategory,
  EventSubsubCategory,
  EventIdentity,
  JobCategory,
  JobSubcategory,
  JobSubsubCategory,
  JobIdentity,
  ProductCategory,
  ProductSubcategory,
  ProductSubsubCategory,
  ProductIdentity,
  ServiceCategory,
  ServiceSubcategory,
  ServiceSubsubCategory,
  ServiceIdentity,
  TourismCategory,
  TourismSubcategory,
  TourismSubsubCategory,
  TourismIdentity,
  FundingCategory,
  FundingSubcategory,
  FundingSubsubCategory,
  FundingIdentity,
  NeedCategory,
  NeedSubcategory,
  NeedSubsubCategory,
  NeedIdentity,
  MomentCategory,
  MomentSubcategory,
  MomentSubsubCategory,
  MomentIdentity,
  JobApplication, // Add this
  EventRegistration, // Add this
  sequelize,
} = require("../models");
const { getConnectionStatusMap } = require("../utils/connectionStatus");
const { cache } = require("../utils/redis");
const { getIdentityCatalogFunc } = require("../utils/identity_taxonomy");

// Cache configuration
const CACHE_TTL = {
  FEED: 300, // 5 minutes for feed data
  META: 3600, // 1 hour for meta data
  SUGGESTIONS: 600, // 10 minutes for suggestions
};

// Load identity catalog for taxonomy validation
let identityCatalog;
(async () => {
  identityCatalog = await getIdentityCatalogFunc('all');
})();

// Helper functions for matching logic
function calculateBidirectionalMatch(aToB, bToA) {
  const average = (aToB + bToA) / 2;
  return average;
}

function calculateReciprocalWeightedMatch(aToB, bToA, weightSelf = 0.7) {
  const weightOther = 1 - weightSelf;
  const userAPerceived = (aToB * weightSelf) + (bToA * weightOther);
  return userAPerceived;
}

// Add the checkIfBelongs function for taxonomy validation
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

// Generate cache key for feed requests
function generateFeedCacheKey(req) {
   const {
     tab,
     q,
     country,
     city,
     categoryId,
     subcategoryId,
     subsubCategoryId,
     identityId,
     industryIds,
     generalCategoryIds,
     generalSubcategoryIds,
     generalSubsubCategoryIds,
     audienceIdentityIds,
     audienceCategoryIds,
     audienceSubcategoryIds,
     audienceSubsubCategoryIds,
     price,
     serviceType,
     priceType,
     deliveryTime,
     experienceLevel,
     locationType,
     jobType,
     workLocation,
     workSchedule,
     careerLevel,
     paymentType,
     jobsView,
     postType,
     season,
     budgetRange,
     fundingGoal,
     amountRaised,
     deadline,
     date,
     eventType,
     registrationType,
     limit = 40,
     offset = 0,
     userId, // Add userId parameter for filtering specific user's posts
   } = req.query;

   const currentUserId = req.user?.id || 'anonymous';
   const userSettings = req.userSettings || {};

   // Create a deterministic key based on all query parameters
   const keyData = {
     tab,
     q,
     country,
     city,
     categoryId,
     subcategoryId,
     subsubCategoryId,
     identityId,
     industryIds,
     generalCategoryIds,
     generalSubcategoryIds,
     generalSubsubCategoryIds,
     audienceIdentityIds,
     audienceCategoryIds,
     audienceSubcategoryIds,
     audienceSubsubCategoryIds,
     price,
     serviceType,
     priceType,
     deliveryTime,
     experienceLevel,
     locationType,
     jobType,
     workLocation,
     workSchedule,
     careerLevel,
     paymentType,
     jobsView,
     postType,
     season,
     budgetRange,
     fundingGoal,
     amountRaised,
     deadline,
     date,
     eventType,
     registrationType,
     limit,
     offset,
     userId, // Include userId in cache key
     currentUserId,
     connectionsOnly: userSettings.connectionsOnly,
     contentType: userSettings.contentType,
   };

  // Sort arrays and stringify for consistent key generation
  Object.keys(keyData).forEach(key => {
    if (Array.isArray(keyData[key])) {
      keyData[key] = keyData[key].sort();
    }
  });

  return `feed:${JSON.stringify(keyData)}`;
}

// Cache wrapper for feed endpoints
async function withCache(cacheKey, ttl, handler, res) {
  try {
    // Try to get from cache first
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      console.log(`✅ Cache hit for key: ${cacheKey}`);
      res.json(cachedResult);
      return cachedResult;
    }

    console.log(`❌ Cache miss for key: ${cacheKey}`);
    // Execute the handler to get the data
    const data = await handler();

    // Cache the result
    try {
      await cache.set(cacheKey, data, ttl);
      console.log(`💾 Cached result for key: ${cacheKey}`);
    } catch (cacheError) {
      console.error('Cache serialization error:', cacheError.message);
      // Continue without caching if serialization fails
    }

    // Send the response
    res.json(data);
    return data;
  } catch (error) {
    console.error('Cache error:', error);
    // If caching fails, execute handler without caching
    try {
      const data = await handler();
      res.json(data);
      return data;
    } catch (handlerError) {
      console.error('Handler error:', handlerError);
      res.status(500).json({ message: "Failed to get feed" });
      throw handlerError; // Re-throw to propagate the error
    }
  }
}

// Cache invalidation functions
async function invalidateFeedCache() {
  try {
    const deletedCount = await cache.delPattern('feed:*');
    console.log(`🗑️ Invalidated ${deletedCount} feed cache entries`);
    return deletedCount;
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return 0;
  }
}

async function invalidateUserFeedCache(userId) {
  try {
    const pattern = `feed:*${userId}*`;
    const deletedCount = await cache.delPattern(pattern);
    console.log(`🗑️ Invalidated ${deletedCount} user feed cache entries for user ${userId}`);
    return deletedCount;
  } catch (error) {
    console.error('User cache invalidation error:', error);
    return 0;
  }
}

exports.getMeta = async (req, res) => {

  const categories = await Category.findAll({
    include: [{ model: Subcategory, as: "subcategories" }],
    order: [
      ["name", "ASC"],
      [{ model: Subcategory, as: "subcategories" }, "name", "ASC"],
    ],
  });

  const identities = await Identity.findAll({
    include: [
      {
        model: Category,
        as: "categories",
        include: [{ model: Subcategory, as: "subcategories" }],
      },
    ],
    order: [
      ["name", "ASC"],
      [{ model: Category, as: "categories" }, "name", "ASC"],
      [
        { model: Category, as: "categories" },
        { model: Subcategory, as: "subcategories" },
        "name",
        "ASC",
      ],
    ],
  });

  const goals = await Goal.findAll({ order: [["name", "ASC"]] });

  const countries = [
    "Angola","Ghana","Nigeria","Kenya","South Africa","Mozambique","Tanzania","Uganda","Zimbabwe","Zambia",
    "Namibia","Cameroon","Senegal","Ivory Coast","Rwanda","Ethiopia","Morocco","Egypt","Sudan"
  ];

  res.json({
    goals,
    identities: identities.map((i) => ({
      id: String(i.id),
      name: i.name,
      categories: categories.map((c) => ({
        id: String(c.id),
        name: c.name,
        subcategories: (c.subcategories || []).map((s) => ({
          id: String(s.id),
          name: s.name,
        })),
      })),
    })),
    categories: categories.map((c) => ({
      id: String(c.id),
      name: c.name,
      subcategories: (c.subcategories || []).map((s) => ({
        id: String(s.id),
        name: s.name,
      })),
    })),
    countries,
  });
};

const like = (v) => ({ [Op.like]: `%${v}%` });
const pickNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [val];
}
function buildOrLikes(field, values) {
  return (values || []).filter(Boolean).map((v) => ({ [field]: like(v) }));
}
function hasTextContent(item) {
  return Boolean(item.description && item.description.trim().length > 0);
}
function hasImageContent(item) {
  const imageFields = ['coverImage', 'coverImageBase64', 'coverImageUrl', 'images', 'attachments'];
  for (const field of imageFields) {
    if (item[field]) {
      if (Array.isArray(item[field]) && item[field].length > 0) return true;
      if (typeof item[field] === 'string' && item[field].trim().length > 0) {
        if (item[field].startsWith('data:image/') && item[field].length < 100) continue;
        return true;
      }
    }
  }
  return false;
}
function applyContentTypeFilter(items, contentType) {
  if (contentType === 'all') return items;
  return items.filter(item => {
    const hasText = hasTextContent(item);
    const hasImages = hasImageContent(item);
    if (contentType === 'text') return hasText && !hasImages;
    if (contentType === 'images') return hasImages;
    return true;
  });
}
function timeAgo(date) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 45) return "Just now";
  if (diff < 90) return "1 min ago";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString();
}


// Helper function to check if user has applied to jobs
async function getUserJobApplicationsStatus(currentUserId, jobIds) {
  if (!currentUserId || !jobIds.length) return {};
  
  const applications = await JobApplication.findAll({
    where: {
      userId: currentUserId,
      jobId: { [Op.in]: jobIds }
    },
    attributes: ['jobId']
  });
  
  const statusMap = {};
  applications.forEach(app => {
    statusMap[app.jobId] = 'applied'; // Default to 'applied' if status is null
  });
  
  return statusMap;
}

// Helper function to check if user has registered for events
async function getUserEventRegistrationsStatus(currentUserId, eventIds) {
  if (!currentUserId || !eventIds.length) return {};
  
  const registrations = await EventRegistration.findAll({
    where: {
      userId: currentUserId,
      eventId: { [Op.in]: eventIds }
    },
    attributes: ['eventId']
  });
  
  const statusMap = {};
  registrations.forEach(reg => {
    statusMap[reg.eventId] ='registered'; // Default to 'registered' if status is null
  });
  
  return statusMap;
}

async function lazyLoadEventAudienceData(events, currentUserId = null) {
  if (!events.length) return events;

  const eventIds = events.map(e => e.id);

  // Batch load all audience data in parallel
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    EventCategory.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      include: [{ model: Category, attributes: ['id', 'name'] }]
    }),
    EventSubcategory.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      include: [{ model: Subcategory, attributes: ['id', 'name'] }]
    }),
    EventSubsubCategory.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      include: [{ model: SubsubCategory, attributes: ['id', 'name'] }]
    }),
    EventIdentity.findAll({
      where: { eventId: { [Op.in]: eventIds } },
      include: [{ model: Identity, attributes: ['id', 'name'] }]
    })
  ]);

  // Map data back to events
  return events.map(event => ({
    ...event.toJSON ? event.toJSON() : event,
    audienceCategories: audienceCategories.filter(ac => ac.eventId === event.id).map(ac => ac.Category),
    audienceSubcategories: audienceSubcategories.filter(as => as.eventId === event.id).map(as => as.Subcategory),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.eventId === event.id).map(ass => ass.SubsubCategory),
    audienceIdentities: audienceIdentities.filter(ai => ai.eventId === event.id).map(ai => ai.Identity)
  }));
}

async function lazyLoadJobAudienceData(jobs, currentUserId = null) {
  if (!jobs.length) return jobs;

  const jobIds = jobs.map(j => j.id);

  // Batch load all audience data in parallel
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    JobCategory.findAll({
      where: { jobId: { [Op.in]: jobIds } },
      include: [{ model: Category, attributes: ['id', 'name'] }]
    }),
    JobSubcategory.findAll({
      where: { jobId: { [Op.in]: jobIds } },
      include: [{ model: Subcategory, attributes: ['id', 'name'] }]
    }),
    JobSubsubCategory.findAll({
      where: { jobId: { [Op.in]: jobIds } },
      include: [{ model: SubsubCategory, attributes: ['id', 'name'] }]
    }),
    JobIdentity.findAll({
      where: { jobId: { [Op.in]: jobIds } },
      include: [{ model: Identity, attributes: ['id', 'name'] }]
    })
  ]);

  // Map data back to jobs
  return jobs.map(job => ({
    ...job.toJSON ? job.toJSON() : job,
    audienceCategories: audienceCategories.filter(ac => ac.jobId === job.id).map(ac => ac.Category),
    audienceSubcategories: audienceSubcategories.filter(as => as.jobId === job.id).map(as => as.Subcategory),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.jobId === job.id).map(ass => ass.SubsubCategory),
    audienceIdentities: audienceIdentities.filter(ai => ai.jobId === job.id).map(ai => ai.Identity)
  }));
}

async function lazyLoadProductAudienceData(products, currentUserId = null) {
  if (!products.length) return products;

  const productIds = products.map(p => p.id);

  // Batch load all audience data in parallel
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    ProductCategory.findAll({
      where: { productId: { [Op.in]: productIds } },
      include: [{ model: Category, attributes: ['id', 'name'] }]
    }),
    ProductSubcategory.findAll({
      where: { productId: { [Op.in]: productIds } },
      include: [{ model: Subcategory, attributes: ['id', 'name'] }]
    }),
    ProductSubsubCategory.findAll({
      where: { productId: { [Op.in]: productIds } },
      include: [{ model: SubsubCategory, attributes: ['id', 'name'] }]
    }),
    ProductIdentity.findAll({
      where: { productId: { [Op.in]: productIds } },
      include: [{ model: Identity, attributes: ['id', 'name'] }]
    })
  ]);

  // Map data back to products
  return products.map(product => ({
    ...product.toJSON ? product.toJSON() : product,
    audienceCategories: audienceCategories.filter(ac => ac.productId === product.id).map(ac => ac.Category),
    audienceSubcategories: audienceSubcategories.filter(as => as.productId === product.id).map(as => as.Subcategory),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.productId === product.id).map(ass => ass.SubsubCategory),
    audienceIdentities: audienceIdentities.filter(ai => ai.productId === product.id).map(ai => ai.Identity)
  }));
}

async function lazyLoadServiceAudienceData(services, currentUserId = null) {
  if (!services.length) return services;

  const serviceIds = services.map(s => s.id);

  // Batch load all audience data in parallel
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    ServiceCategory.findAll({
      where: { serviceId: { [Op.in]: serviceIds } },
      include: [{ model: Category, attributes: ['id', 'name'] }]
    }),
    ServiceSubcategory.findAll({
      where: { serviceId: { [Op.in]: serviceIds } },
      include: [{ model: Subcategory, attributes: ['id', 'name'] }]
    }),
    ServiceSubsubCategory.findAll({
      where: { serviceId: { [Op.in]: serviceIds } },
      include: [{ model: SubsubCategory, attributes: ['id', 'name'] }]
    }),
    ServiceIdentity.findAll({
      where: { serviceId: { [Op.in]: serviceIds } },
      include: [{ model: Identity, attributes: ['id', 'name'] }]
    })
  ]);

  // Map data back to services
  return services.map(service => ({
    ...service.toJSON ? service.toJSON() : service,
    audienceCategories: audienceCategories.filter(ac => ac.serviceId === service.id).map(ac => ac.Category),
    audienceSubcategories: audienceSubcategories.filter(as => as.serviceId === service.id).map(as => as.Subcategory),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.serviceId === service.id).map(ass => ass.SubsubCategory),
    audienceIdentities: audienceIdentities.filter(ai => ai.serviceId === service.id).map(ai => ai.Identity)
  }));
}

async function lazyLoadTourismAudienceData(tourism, currentUserId = null) {
  if (!tourism.length) return tourism;

  const tourismIds = tourism.map(t => t.id);

  // Batch load all audience data in parallel using raw SQL queries
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    sequelize.query(`
      SELECT tc.tourismId, c.id, c.name
      FROM tourism_categories tc
      JOIN categories c ON tc.categoryId = c.id
      WHERE tc.tourismId IN (:tourismIds)
    `, {
      replacements: { tourismIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT tsc.tourismId, sc.id, sc.name
      FROM tourism_subcategories tsc
      JOIN subcategories sc ON tsc.subcategoryId = sc.id
      WHERE tsc.tourismId IN (:tourismIds)
    `, {
      replacements: { tourismIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT tssc.tourismId, ssc.id, ssc.name
      FROM tourism_subsubcategories tssc
      JOIN subsubcategories ssc ON tssc.subsubcategoryId = ssc.id
      WHERE tssc.tourismId IN (:tourismIds)
    `, {
      replacements: { tourismIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT ti.tourismId, i.id, i.name
      FROM tourism_identities ti
      JOIN identities i ON ti.identityId = i.id
      WHERE ti.tourismId IN (:tourismIds)
    `, {
      replacements: { tourismIds },
      type: sequelize.QueryTypes.SELECT
    })
  ]);

  // Map data back to tourism
  return tourism.map(tour => ({
    ...tour.toJSON ? tour.toJSON() : tour,
    audienceCategories: audienceCategories.filter(ac => ac.tourismId === tour.id).map(ac => ({ id: ac.id, name: ac.name })),
    audienceSubcategories: audienceSubcategories.filter(as => as.tourismId === tour.id).map(as => ({ id: as.id, name: as.name })),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.tourismId === tour.id).map(ass => ({ id: ass.id, name: ass.name })),
    audienceIdentities: audienceIdentities.filter(ai => ai.tourismId === tour.id).map(ai => ({ id: ai.id, name: ai.name }))
  }));
}

async function lazyLoadFundingAudienceData(funding, currentUserId = null) {
  if (!funding.length) return funding;

  const fundingIds = funding.map(f => f.id);

  // Batch load all audience data in parallel using raw SQL queries
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    sequelize.query(`
      SELECT fc.fundingId, c.id, c.name
      FROM funding_categories fc
      JOIN categories c ON fc.categoryId = c.id
      WHERE fc.fundingId IN (:fundingIds)
    `, {
      replacements: { fundingIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT fsc.fundingId, sc.id, sc.name
      FROM funding_subcategories fsc
      JOIN subcategories sc ON fsc.subcategoryId = sc.id
      WHERE fsc.fundingId IN (:fundingIds)
    `, {
      replacements: { fundingIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT fssc.fundingId, ssc.id, ssc.name
      FROM funding_subsubcategories fssc
      JOIN subsubcategories ssc ON fssc.subsubcategoryId = ssc.id
      WHERE fssc.fundingId IN (:fundingIds)
    `, {
      replacements: { fundingIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT fi.fundingId, i.id, i.name
      FROM funding_identities fi
      JOIN identities i ON fi.identityId = i.id
      WHERE fi.fundingId IN (:fundingIds)
    `, {
      replacements: { fundingIds },
      type: sequelize.QueryTypes.SELECT
    })
  ]);

  // Map data back to funding
  return funding.map(fund => ({
    ...fund.toJSON ? fund.toJSON() : fund,
    audienceCategories: audienceCategories.filter(ac => ac.fundingId === fund.id).map(ac => ({ id: ac.id, name: ac.name })),
    audienceSubcategories: audienceSubcategories.filter(as => as.fundingId === fund.id).map(as => ({ id: as.id, name: as.name })),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.fundingId === fund.id).map(ass => ({ id: ass.id, name: ass.name })),
    audienceIdentities: audienceIdentities.filter(ai => ai.fundingId === fund.id).map(ai => ({ id: ai.id, name: ai.name }))
  }));
}

async function lazyLoadNeedAudienceData(needs, currentUserId = null) {
  if (!needs.length) return needs;

  const needIds = needs.map(n => n.id);

  // Batch load all audience data in parallel using raw SQL queries
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    sequelize.query(`
      SELECT nc.needId, c.id, c.name
      FROM need_categories nc
      JOIN categories c ON nc.categoryId = c.id
      WHERE nc.needId IN (:needIds)
    `, {
      replacements: { needIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT nsc.needId, sc.id, sc.name
      FROM need_subcategories nsc
      JOIN subcategories sc ON nsc.subcategoryId = sc.id
      WHERE nsc.needId IN (:needIds)
    `, {
      replacements: { needIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT nssc.needId, ssc.id, ssc.name
      FROM need_subsubcategories nssc
      JOIN subsubcategories ssc ON nssc.subsubcategoryId = ssc.id
      WHERE nssc.needId IN (:needIds)
    `, {
      replacements: { needIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT ni.needId, i.id, i.name
      FROM need_identities ni
      JOIN identities i ON ni.identityId = i.id
      WHERE ni.needId IN (:needIds)
    `, {
      replacements: { needIds },
      type: sequelize.QueryTypes.SELECT
    })
  ]);

  // Map data back to needs
  return needs.map(need => ({
    ...need.toJSON ? need.toJSON() : need,
    audienceCategories: audienceCategories.filter(ac => ac.needId === need.id).map(ac => ({ id: ac.id, name: ac.name })),
    audienceSubcategories: audienceSubcategories.filter(as => as.needId === need.id).map(as => ({ id: as.id, name: as.name })),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.needId === need.id).map(ass => ({ id: ass.id, name: ass.name })),
    audienceIdentities: audienceIdentities.filter(ai => ai.needId === need.id).map(ai => ({ id: ai.id, name: ai.name }))
  }));
}

async function lazyLoadMomentAudienceData(moments, currentUserId = null) {
  if (!moments.length) return moments;

  const momentIds = moments.map(m => m.id);

  // Batch load all audience data in parallel using raw SQL queries
  const [audienceCategories, audienceSubcategories, audienceSubsubs, audienceIdentities] = await Promise.all([
    sequelize.query(`
      SELECT mc.momentId, c.id, c.name
      FROM moment_categories mc
      JOIN categories c ON mc.categoryId = c.id
      WHERE mc.momentId IN (:momentIds)
    `, {
      replacements: { momentIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT msc.momentId, sc.id, sc.name
      FROM moment_subcategories msc
      JOIN subcategories sc ON msc.subcategoryId = sc.id
      WHERE msc.momentId IN (:momentIds)
    `, {
      replacements: { momentIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT mssc.momentId, ssc.id, ssc.name
      FROM moment_subsubcategories mssc
      JOIN subsubcategories ssc ON mssc.subsubcategoryId = ssc.id
      WHERE mssc.momentId IN (:momentIds)
    `, {
      replacements: { momentIds },
      type: sequelize.QueryTypes.SELECT
    }),
    sequelize.query(`
      SELECT mi.momentId, i.id, i.name
      FROM moment_identities mi
      JOIN identities i ON mi.identityId = i.id
      WHERE mi.momentId IN (:momentIds)
    `, {
      replacements: { momentIds },
      type: sequelize.QueryTypes.SELECT
    })
  ]);

  // Map data back to moments
  return moments.map(moment => ({
    ...moment.toJSON ? moment.toJSON() : moment,
    audienceCategories: audienceCategories.filter(ac => ac.momentId === moment.id).map(ac => ({ id: ac.id, name: ac.name })),
    audienceSubcategories: audienceSubcategories.filter(as => as.momentId === moment.id).map(as => ({ id: as.id, name: as.name })),
    audienceSubsubs: audienceSubsubs.filter(ass => ass.momentId === moment.id).map(ass => ({ id: ass.id, name: ass.name })),
    audienceIdentities: audienceIdentities.filter(ai => ai.momentId === moment.id).map(ai => ({ id: ai.id, name: ai.name }))
  }));
}

function filterByAudienceCriteria(items, audienceIdentityIds, audienceCategoryIds, audienceSubcategoryIds, audienceSubsubCategoryIds) {
  if (!items.length) return items;

  // If no audience filters are applied, return all items
  if (!audienceIdentityIds?.length && !audienceCategoryIds?.length &&
      !audienceSubcategoryIds?.length && !audienceSubsubCategoryIds?.length) {
    return items;
  }

  return items.filter(item => {
    const itemAudienceCategories = (item.audienceCategories || []).map(c => String(c.id));
    const itemAudienceSubcategories = (item.audienceSubcategories || []).map(s => String(s.id));
    const itemAudienceSubsubs = (item.audienceSubsubs || []).map(s => String(s.id));
    const itemAudienceIdentities = (item.audienceIdentities || []).map(i => String(i.id));

    // Check if item matches any of the audience criteria
    const matchesIdentity = !audienceIdentityIds?.length ||
      audienceIdentityIds.some(id => itemAudienceIdentities.includes(String(id)));

    const matchesCategory = !audienceCategoryIds?.length ||
      audienceCategoryIds.some(id => itemAudienceCategories.includes(String(id)));

    const matchesSubcategory = !audienceSubcategoryIds?.length ||
      audienceSubcategoryIds.some(id => itemAudienceSubcategories.includes(String(id)));

    const matchesSubsubCategory = !audienceSubsubCategoryIds?.length ||
      audienceSubsubCategoryIds.some(id => itemAudienceSubsubs.includes(String(id)));

    // Item matches if it matches ALL applied criteria (AND logic)
    return matchesIdentity && matchesCategory && matchesSubcategory && matchesSubsubCategory;
  });
}

const includeCategoryRefs = [
  {
    model: User,
    as: "postedBy",
    attributes: ["id", "name", "avatarUrl","accountType"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] }],
  },
];

const includeEventRefs = [
  {
    model: User,
    as: "organizer",
    attributes: ["id", "name", "avatarUrl","accountType"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] }],
  },
];

const includeNeedRefs = [
   {
     model: User,
     as: "user",
     attributes: ["id", "name", "avatarUrl","accountType"],
     include: [{ model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] }],
   },
];

async function makeCompanyMapById(ids) {
  const uniq = Array.from(new Set((ids || []).filter(Boolean).map(String)));
  if (!uniq.length) return {};
  const companies = await User.findAll({
    where: { id: { [Op.in]: uniq }, accountType: "company" },
    attributes: ["id", "name", "avatarUrl", "accountType"],
    include: [{ model: Profile, as: "profile", attributes: ["avatarUrl", "professionalTitle"] }],
  });
  const map = {};
  for (const c of companies) {
    map[String(c.id)] = {
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl || c.profile?.avatarUrl || null,
      accountType: c.accountType || null,
      professionalTitle: c.profile?.professionalTitle || null,
    };
  }
  return map;
}

function makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const interestsWhere = {};
  if (categoryId) interestsWhere.categoryId = categoryId;
  if (subcategoryId) interestsWhere.subcategoryId = subcategoryId;
  if (subsubCategoryId) interestsWhere.subsubcategoryId = subsubCategoryId;
  const needInterests = false// Boolean(categoryId || subcategoryId || subsubCategoryId);
  return [
    {
      model: User,
      as: "provider",
      attributes: ["id", "name", "avatarUrl","accountType"],
      include: [
        {
          model: UserCategory,
          as: "interests",
          required: needInterests,
          where: Object.keys(interestsWhere).length ? interestsWhere : undefined,
          include: [
            { model: Category, as: "category", attributes: ["id", "name"], required: false },
            { model: Subcategory, as: "subcategory", attributes: ["id", "name"], required: false },
          ],
        },
        { model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] },
      ],
    },
  ];
}


function makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }) {
  const include = [
    {
      model: User,
      as: "seller",
      attributes: ["id", "name", "avatarUrl","accountType"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] }],
    },
  ];
  return include;
}

function makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }) {
   const include = [
     {
       model: User,
       as: "author",
       attributes: ["id", "name", "avatarUrl","accountType"],
       include: [{ model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] }],
     },
    ];
     return include;
 }

function makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }) {
    const include = [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "avatarUrl","accountType"],
        include: [{ model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] }],
      },
    ];
    return include;
  }

function makeFundingInclude() {
   return [
     {
       model: User,
       as: "creator",
      attributes: ["id", "name", "avatarUrl","accountType"],
      include: [{ model: Profile, as: "profile", attributes: ["avatarUrl","professionalTitle"] }],
     },
  ];
 }


function sortByMatchThenRecency(arr) {
  return arr.sort((a, b) => {
    const am = Number.isFinite(a.matchPercentage) ? a.matchPercentage : (Number(a._score) || 0);
    const bm = Number.isFinite(b.matchPercentage) ? b.matchPercentage : (Number(b._score) || 0);
    if (bm !== am) return bm - am; // higher matchPercentage (or _score) first
    const ad = new Date(a.createdAt).getTime() || 0;
    const bd = new Date(b.createdAt).getTime() || 0;
    return bd - ad; // tie-break by recency
  });
}


function diversifyFeed(items, { maxSeq = 1 } = {}) {
  const pool = items.slice();
  const out = [];
  let lastKind = null;
  let streak = 0;
  while (pool.length) {
    let pickIdx = pool.findIndex((it) => {
      if (!lastKind) return true;
      if (it.kind !== lastKind) return true;
      return streak < maxSeq;
    });
    if (pickIdx === -1) pickIdx = 0;
    const [picked] = pool.splice(pickIdx, 1);
    if (picked.kind === lastKind) {
      streak += 1;
    } else {
      lastKind = picked.kind;
      streak = 1;
    }
    out.push(picked);
  }
  return out;
}



async function fetchMomentsPaged({ where, include, limit, offset, order = [["createdAt", "DESC"]] }) {
  const whereIds = { 
    ...(where || {}), 
    moderation_status: "approved" 
  };
  
  const idRows = await Moment.findAll({
    where: whereIds,
    attributes: ["id", "createdAt"],
    order,
    limit: limit ?? 40,
    offset: offset ?? 0,
    raw: true,
  });
  
  const ids = idRows.map((r) => r.id);
  if (!ids.length) return [];
  
  const rows = await Moment.findAll({
    where: { id: { [Op.in]: ids } },
    include,
    order: [["createdAt", "DESC"]],
    distinct: true,
  });
  
  return rows;
}


function normalizeToArray(v) {
  if (!v) return null;
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === "string") {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [v];
}

const W = { x: 3, sub: 2.5, cat: 2, id: 1.5, city: 1.5, country: 1 };

exports.getFeed = async (req, res) => {

  try {
    // Generate cache key for this request
    const cacheKey = generateFeedCacheKey(req);

    // Use caching wrapper
    const result = await withCache(cacheKey, CACHE_TTL.FEED, async () => {
    const {
      tab,
      q,
      country,
      city,
      categoryId,
      subcategoryId,
      subsubCategoryId,
      identityId,
      industryIds,
      generalCategoryIds,
      generalSubcategoryIds,
      generalSubsubCategoryIds,
      audienceIdentityIds,
      audienceCategoryIds,
      audienceSubcategoryIds,
      audienceSubsubCategoryIds,
      price,
      serviceType,
      priceType,
      deliveryTime,
      experienceLevel,
      locationType,
      jobType,
      workLocation,
      workSchedule,
      careerLevel,
      paymentType,
      jobsView,
      postType,
      season,
      budgetRange,
      fundingGoal,
      amountRaised,
      deadline,
      date,
      eventType,
      registrationType,
      limit = 40,
      offset = 0,
      userId, // Add userId parameter for filtering specific user's posts
    } = req.query;

    const tabToEntityTypeMap = {
      jobs: "job",
      events: "event",
      services: "service",
      products: "product",
      tourism: "tourism",
      funding: "funding",
      needs: "need",
      moments: "moment",
    };
    const relatedEntityType = tabToEntityTypeMap[tab];

    const cities = ensureArray(city);
    const currentUserId = req.user?.id || null;

    let userSettings = null;
    let connectionsOnly = false;
    let contentType = 'all';
    let connectedUserIds = [];

    const hasIncompatibleFilters = Boolean(
      price || serviceType || priceType || deliveryTime ||
      experienceLevel || locationType || jobType ||
      workLocation || workSchedule || careerLevel || paymentType ||
      postType || season || budgetRange || fundingGoal || generalCategoryIds || generalSubcategoryIds ||
      amountRaised || deadline || eventType || registrationType
    );

    console.log({generalCategoryIds})


    if (currentUserId) {
  try {
    const me = await User.findByPk(currentUserId, {
      attributes: ["id", "country", "city", "accountType"],
      include: [
        { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] }
      ],
    });
    
    if (me) {
      userDefaults.country = me.country || null;
      userDefaults.city = me.city || null;
      userDefaults.categoryIds = (me.interests || []).map((i) => i.categoryId).filter(Boolean);
      userDefaults.subcategoryIds = (me.interests || []).map((i) => i.subcategoryId).filter(Boolean);
      
      // ADD THESE LINES to load the missing interest types:
      try {
        const subsubInterests = await UserSubsubCategoryInterest.findAll({
          where: { userId: currentUserId },
          include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }],
        });
        userDefaults.subsubcategoryIds = subsubInterests.map((i) => i.subsubCategoryId).filter(Boolean);
      } catch {}
      
      try {
        const identityInterests = await UserIdentityInterest.findAll({
          where: { userId: currentUserId },
          include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }],
        });
        userDefaults.identityIds = identityInterests.map((i) => i.identityId).filter(Boolean);
      } catch {}
    }
  } catch {}
}

    const effIndustryIds = ensureArray(industryIds).filter(Boolean);

    let searchTerms = [];
    if (q) {
      searchTerms = q.split(/\s+/).map(t => t.trim()).filter(t => t.length >= 2);
    }

    const lim = pickNumber(limit) ?? 20;
    const off = pickNumber(offset) ?? 0;

    const effAudienceIdentityIds = ensureArray(audienceIdentityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);

    const effGeneralCategoryIds = ensureArray(generalCategoryIds).filter(Boolean);
    const effGeneralSubcategoryIds = ensureArray(generalSubcategoryIds).filter(Boolean);
    const effGeneralSubsubCategoryIds = ensureArray(generalSubsubCategoryIds).filter(Boolean);

    const effAudienceIdentityIdsStr = effAudienceIdentityIds.map(String);
    const effAudienceCategoryIdsStr = effAudienceCategoryIds.map(String);
    const effAudienceSubcategoryIdsStr = effAudienceSubcategoryIds.map(String);
    const effAudienceSubsubCategoryIdsStr = effAudienceSubsubCategoryIds.map(String);

    const effGeneralCategoryIdsStr = effGeneralCategoryIds.map(String);
    const effGeneralSubcategoryIdsStr = effGeneralSubcategoryIds.map(String);
    const effGeneralSubsubCategoryIdsStr = effGeneralSubsubCategoryIds.map(String);

    const hasTextSearch = Boolean(q && searchTerms.length > 0);

    const hasExplicitFilter = Boolean(
      country || city || categoryId || subcategoryId || subsubCategoryId || identityId ||
      effIndustryIds.length ||
      effGeneralCategoryIds.length || effGeneralSubcategoryIds.length || effGeneralSubsubCategoryIds.length ||
      effAudienceIdentityIds.length || effAudienceCategoryIds.length ||
      effAudienceSubcategoryIds.length || effAudienceSubsubCategoryIds.length ||
      price || serviceType || priceType || deliveryTime ||
      experienceLevel || locationType || jobType ||
      postType || season || budgetRange ||
      fundingGoal || amountRaised || deadline ||
      eventType || date || registrationType ||
      hasTextSearch || (cities && cities.length > 0)
    );

    let userDefaults = {
      country: null,
      city: null,
      interestCategoryIds: [],
      interestSubcategoryIds: [],
      interestSubsubCategoryIds: [],
      interestIdentityIds: [],
      attributeCategoryIds: [],
      attributeSubcategoryIds: [],
      attributeSubsubCategoryIds: [],
      attributeIdentityIds: [],
    };

    if (currentUserId) {
      try {
        const me = await User.findByPk(currentUserId, {
          attributes: ["id", "country", "city", "accountType"],
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["categoryId", "subcategoryId"],
              required: false,
            },
            { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] },
          ],
        });

        if (me) {
          userDefaults.country = me.country || null;
          userDefaults.city = me.city || null;

          const attributeCats = (me.interests || []).map((i) => i.categoryId).filter(Boolean);
          const attributeSubs = (me.interests || []).map((i) => i.subcategoryId).filter(Boolean);

          if (me.profile?.categoryId) attributeCats.push(me.profile.categoryId);
          if (me.profile?.subcategoryId) attributeSubs.push(me.profile.subcategoryId);

          userDefaults.attributeCategoryIds = Array.from(new Set(attributeCats));
          userDefaults.attributeSubcategoryIds = Array.from(new Set(attributeSubs));

          userDefaults.interestCategoryIds = [];
          userDefaults.interestSubcategoryIds = [];
          userDefaults.interestSubsubCategoryIds = [];
          userDefaults.interestIdentityIds = [];

          try {
            const categoryInterests = await UserCategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Category, as: "category", attributes: ["id", "name"] }],
            });
            userDefaults.interestCategoryIds = categoryInterests.map((i) => i.categoryId).filter(Boolean);
          } catch {}

          try {
            const subcategoryInterests = await UserSubcategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"] }],
            });
            userDefaults.interestSubcategoryIds = subcategoryInterests.map((i) => i.subcategoryId).filter(Boolean);
          } catch {}

          try {
            const subsubInterests = await UserSubsubCategoryInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }],
            });
            userDefaults.interestSubsubCategoryIds = subsubInterests.map((i) => i.subsubCategoryId).filter(Boolean);
          } catch {}

          try {
            const identityInterests = await UserIdentityInterest.findAll({
              where: { userId: currentUserId },
              include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }],
            });
            userDefaults.interestIdentityIds = identityInterests.map((i) => i.identityId).filter(Boolean);
          } catch {}
        }
      } catch {}
    }

    const countries = ensureArray(country);

    /*const createFlexibleLocationFilter = () => {
      const filter = {};
      const countryExact = countries.length ? [{ country: { [Op.in]: countries } }] : [];
      const cityLikes = buildOrLikes("city", cities);
      const cityInCountryField = buildOrLikes("country", cities);
      const countryInCityField = buildOrLikes("city", countries);
      const orParts = [];
      if (countries.length && cities.length) {
        orParts.push(...countryExact, ...cityLikes, ...countryInCityField, ...cityInCountryField);
      } else if (countries.length) {
        orParts.push(...countryExact, ...cityInCountryField);
      } else if (cities.length) {
        orParts.push(...cityLikes, ...cityInCountryField);
      }
      if (orParts.length) {
        filter[Op.or] = orParts;
      }
      return filter;
    };*/


    const createFlexibleLocationFilter = () => {
        const filter = {};
        const countryExact = countries.length ? [{ country: { [Op.in]: countries } }] : [];
        const cityLikes = buildOrLikes("city", cities);
        const cityInCountryField = buildOrLikes("country", cities);
        const countryInCityField = buildOrLikes("city", countries);
        
        if (countries.length && cities.length) {
          // Create AND conditions: must match both city AND country
          const andConditions = [];
          
          // Add country condition
          andConditions.push({ country: { [Op.in]: countries } });
          
          // Add city condition (partial matches)
          andConditions.push({
            [Op.or]: [
              ...cityLikes,
              ...cityInCountryField
            ]
          });
          
          filter[Op.and] = andConditions;
        } else if (countries.length) {
          filter[Op.or] = [...countryExact, ...cityInCountryField];
        } else if (cities.length) {
          filter[Op.or] = [...cityLikes, ...cityInCountryField];
        }
        return filter;
};


const createJobLocationFilter = () => {
  const filter = {};
  
  if (countries.length && cities.length) {
    // AND logic: must match both city AND country
    filter[Op.or] = [
      // Match in regular fields (AND logic)
      {
        [Op.and]: [
          { country: { [Op.in]: countries } },
          {
            [Op.or]: [
              ...buildOrLikes("city", cities),
              ...buildOrLikes("country", cities)
            ]
          }
        ]
      },
      // Match in countries JSON array - create separate conditions for each combination
      {
        [Op.and]: [
          // At least one country matches in the JSON array
          {
            [Op.or]: countries.map(country => 
              sequelize.literal(`JSON_SEARCH(countries, 'one', '%${country}%', NULL, '$[*].country') IS NOT NULL`)
            )
          },
          // At least one city matches in the JSON array
          {
            [Op.or]: cities.map(city => 
              sequelize.literal(`JSON_SEARCH(countries, 'one', '%${city}%', NULL, '$[*].city') IS NOT NULL`)
            )
          }
        ]
      }
    ];
  } else if (countries.length) {
    // Only country specified
    filter[Op.or] = [
      // Regular fields
      { country: { [Op.in]: countries } },
      ...buildOrLikes("country", countries),
      // Countries JSON array - create separate conditions for each country
      {
        [Op.or]: countries.map(country => 
          sequelize.literal(`JSON_SEARCH(countries, 'one', '%${country}%', NULL, '$[*].country') IS NOT NULL`)
        )
      }
    ];
  } else if (cities.length) {
    // Only city specified
    filter[Op.or] = [
      // Regular fields
      ...buildOrLikes("city", cities),
      ...buildOrLikes("country", cities),
      // Countries JSON array - create separate conditions for each city
      {
        [Op.or]: cities.map(city => 
          sequelize.literal(`JSON_SEARCH(countries, 'one', '%${city}%', NULL, '$[*].city') IS NOT NULL`)
        )
      }
    ];
  }
  
  return filter;
};

    let whereCommon = createFlexibleLocationFilter();
    let whereJob = { ...createJobLocationFilter() };
    let whereEvent = { ...whereCommon };
    let whereService = { ...whereCommon };
    let whereNeed = { ...whereCommon };

    if (effGeneralCategoryIds.length > 0) {
      whereService.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereService.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereService.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    if (effGeneralCategoryIds.length > 0) {
      whereNeed.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereNeed.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereNeed.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    if (effGeneralCategoryIds.length > 0) {
      whereEvent.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    }
    if (effGeneralSubcategoryIds.length > 0) {
      whereEvent.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    }
    if (effGeneralSubsubCategoryIds.length > 0) {
      whereEvent.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };
    }

    let whereProduct = {};
    
    
  
  if (countries.length || cities.length) {
    if (countries.length && cities.length) {
      // AND logic: must match both country AND city
      whereProduct[Op.and] = [
        { country: { [Op.in]: countries } },
        {
          [Op.or]: [
            ...buildOrLikes("city", cities),
            ...buildOrLikes("country", cities)
          ]
        }
      ];
    } else if (countries.length) {
      whereProduct[Op.or] = [
        { country: { [Op.in]: countries } },
        ...buildOrLikes("country", countries)
      ];
    } else if (cities.length) {
      whereProduct[Op.or] = [
        ...buildOrLikes("city", cities),
        ...buildOrLikes("country", cities)
      ];
    }
  }

    if (price) whereProduct.price = { [Op.lte]: Number(price) };
    if (effGeneralCategoryIds.length > 0) whereProduct.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereProduct.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereProduct.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    let whereTourism = {};
    const tourismOr = [];
   
    if (countries.length || cities.length) {
    const tourismConditions = [];
    
    if (countries.length && cities.length) {
      tourismConditions.push(
        { country: { [Op.in]: countries } },
        {
          [Op.or]: [
            ...buildOrLikes("location", cities),
            ...buildOrLikes("country", cities)
          ]
        }
      );
      whereTourism[Op.and] = tourismConditions;
    } else if (countries.length) {
      whereTourism[Op.or] = [
        { country: { [Op.in]: countries } },
        ...buildOrLikes("location", countries),
        ...buildOrLikes("country", countries)
      ];
    } else if (cities.length) {
      whereTourism[Op.or] = [
        ...buildOrLikes("location", cities),
        ...buildOrLikes("country", cities)
      ];
    }
  }


    if (tourismOr.length) whereTourism[Op.or] = tourismOr;
    if (effGeneralCategoryIds.length > 0) whereTourism.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereTourism.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereTourism.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    let whereFunding = createFlexibleLocationFilter();
    if (effGeneralCategoryIds.length > 0) whereFunding.generalCategoryId = { [Op.in]: effGeneralCategoryIds };
    if (effGeneralSubcategoryIds.length > 0) whereFunding.generalSubcategoryId = { [Op.in]: effGeneralSubcategoryIds };
    if (effGeneralSubsubCategoryIds.length > 0) whereFunding.generalSubsubCategoryId = { [Op.in]: effGeneralSubsubCategoryIds };

    // Add user filtering when userId parameter is provided
    if (userId) {
      whereJob.postedByUserId = userId;
      whereEvent.organizerUserId = userId;
      whereService.providerUserId = userId;
      whereProduct.sellerUserId = userId;
      whereTourism.authorUserId = userId;
      whereFunding.creatorUserId = userId;
      whereNeed.userId = userId;
      whereCommon.userId = userId; // For moments
    }

    let excludedUserIds = [];
    if (currentUserId) {
      const [iBlock, theyBlock] = await Promise.all([
        UserBlock.findAll({ where: { blockerId: currentUserId }, attributes: ["blockedId"] }),
        UserBlock.findAll({ where: { blockedId: currentUserId }, attributes: ["blockerId"] }),
      ]);
      excludedUserIds = [...new Set([
        ...iBlock.map((r) => String(r.blockedId)),
        ...theyBlock.map((r) => String(r.blockerId)),
      ])];
    }

    if (excludedUserIds.length) {
      whereJob.postedByUserId = { [Op.notIn]: excludedUserIds };
      whereEvent.organizerUserId = { [Op.notIn]: excludedUserIds };
      whereService.providerUserId = { [Op.notIn]: excludedUserIds };
      whereProduct.sellerUserId = { [Op.notIn]: excludedUserIds };
      whereTourism.authorUserId = { [Op.notIn]: excludedUserIds };
      whereFunding.creatorUserId = { [Op.notIn]: excludedUserIds };
      whereNeed.userId = { [Op.notIn]: excludedUserIds };
    }

    if (fundingGoal) whereFunding.goal = { [Op.lte]: Number(fundingGoal) };
    if (amountRaised) whereFunding.raised = { [Op.gte]: Number(amountRaised) };
    if (deadline) whereFunding.deadline = { [Op.gte]: deadline };

    if (categoryId) {
      whereJob.categoryId = categoryId;
      whereEvent.categoryId = categoryId;
      whereNeed.categoryId = categoryId;
    }
    if (subcategoryId) {
      whereJob.subcategoryId = subcategoryId;
      whereEvent.subcategoryId = subcategoryId;
      whereNeed.subcategoryId = subcategoryId;
    }
    if (subsubCategoryId) {
      whereJob.subsubCategoryId = subsubCategoryId;
      whereEvent.subsubCategoryId = subsubCategoryId;
      whereNeed.subsubCategoryId = subsubCategoryId;
    }

    if (connectionsOnly && connectedUserIds.length > 0) {
      whereJob.postedByUserId = { [Op.in]: connectedUserIds };
      whereEvent.organizerUserId = { [Op.in]: connectedUserIds };
      whereService.providerUserId = { [Op.in]: connectedUserIds };
      whereProduct.sellerUserId = { [Op.in]: connectedUserIds };
      whereTourism.authorUserId = { [Op.in]: connectedUserIds };
      whereFunding.creatorUserId = { [Op.in]: connectedUserIds };
      whereNeed.userId = { [Op.in]: connectedUserIds };
      whereCommon.userId = { [Op.in]: connectedUserIds };
    }

    if (effIndustryIds.length > 0) {
      whereJob.industryCategoryId = { [Op.in]: effIndustryIds };
      whereEvent.industryCategoryId = { [Op.in]: effIndustryIds };
      whereService.industryCategoryId = { [Op.in]: effIndustryIds };
      whereProduct.industryCategoryId = { [Op.in]: effIndustryIds };
      whereTourism.industryCategoryId = { [Op.in]: effIndustryIds };
      whereFunding.industryCategoryId = { [Op.in]: effIndustryIds };
      whereNeed.industryCategoryId = { [Op.in]: effIndustryIds };
      whereCommon.industryCategoryId = { [Op.in]: effIndustryIds }; // For moments
    }

    // Audience filtering is now handled after lazy loading since we removed eager loading
    // The filtering will be applied to the results after audience data is loaded

    if (jobType) {
      const jobTypes = jobType.split(",").filter(Boolean);
      if (jobTypes.length) whereJob.jobType = { [Op.in]: jobTypes };
    }
   
    if (workLocation) {
      const workLocations = workLocation.split(",").filter(Boolean);
      if (workLocations.length) whereJob.workLocation = { [Op.in]: workLocations };
    }
    if (workSchedule) {
      const workSchedules = workSchedule.split(",").filter(Boolean);
      if (workSchedules.length) whereJob.workSchedule = { [Op.in]: workSchedules };
    }
    if (careerLevel) {
      const careerLevels = careerLevel.split(",").filter(Boolean);
      if (careerLevels.length) whereJob.careerLevel = { [Op.in]: careerLevels };
    }
    if (paymentType) {
      const paymentTypes = paymentType.split(",").filter(Boolean);
      if (paymentTypes.length) whereJob.paymentType = { [Op.in]: paymentTypes };
    }
    if (experienceLevel) {
      const els = experienceLevel.split(",").filter(Boolean);
      if (els.length) {
        whereJob.experienceLevel = { [Op.in]: els };
        whereService.experienceLevel = { [Op.in]: els };
      }
    }
    if (locationType) {
      const lts = locationType.split(",").filter(Boolean);
      if (lts.length) {
        whereJob.locationType = { [Op.in]: lts };
        whereService.locationType = { [Op.in]: lts };
      }
    }

    if (serviceType) {
      const sts = serviceType.split(",").filter(Boolean);
      if (sts.length) whereService.serviceType = { [Op.in]: sts };
    }
    if (priceType) {
      const pts = priceType.split(",").filter(Boolean);
      if (pts.length) whereService.priceType = { [Op.in]: pts };
    }
    if (deliveryTime) {
      const dts = deliveryTime.split(",").filter(Boolean);
      if (dts.length) whereService.deliveryTime = { [Op.in]: dts };
    }

    if (postType) {
      const pts = postType.split(",").filter(Boolean);
      if (pts.length) whereTourism.postType = { [Op.in]: pts };
    }
    if (season) {
      const ss = season.split(",").filter(Boolean);
      if (ss.length) whereTourism.season = { [Op.in]: ss };
    }
    if (budgetRange) {
      const brs = budgetRange.split(",").filter(Boolean);
      if (brs.length) whereTourism.budgetRange = { [Op.in]: brs };
    }

    if (eventType) {
      const ets = eventType.split(",").filter(Boolean);
      if (ets.length) whereEvent.eventType = { [Op.in]: ets };
    }
    if (date) whereEvent.date = { [Op.gte]: date };
    if (registrationType) {
      const rts = registrationType.split(",").filter(Boolean);
      if (rts.length) whereEvent.registrationType = { [Op.in]: rts };
    }

    /*if (hasTextSearch) {
      const termClauses = (fields) =>
        searchTerms.flatMap((term) => fields.map((f) => ({ [f]: like(term) })));
      whereJob[Op.or] = [
        ...(whereJob[Op.or] || []),
        ...termClauses(["title", "companyName", "city", "country"]),
      ];
      whereEvent[Op.or] = [
        ...(whereEvent[Op.or] || []),
        ...termClauses(["title", "description", "city", "country"]),
      ];
      whereService[Op.or] = [
        ...(whereService[Op.or] || []),
        ...termClauses(["title", "description", "city", "country"]),
      ];
      whereProduct[Op.or] = [
        ...(whereProduct[Op.or] || []),
        ...termClauses(["title", "description", "country"]),
      ];
      whereTourism[Op.or] = [
        ...(whereTourism[Op.or] || []),
        ...termClauses(["title", "description", "location", "country"]),
      ];
      whereFunding[Op.or] = [
        ...(whereFunding[Op.or] || []),
        ...termClauses(["title", "pitch", "city", "country"]),
      ];
      whereNeed[Op.or] = [
        ...(whereNeed[Op.or] || []),
        ...termClauses(["title", "description", "city", "country"]),
      ];
    }*/

     
      
   
       if (hasTextSearch) {
  console.log('🔍 Search initiated:', { q, searchTerms, tab });
  
  // More precise search conditions
  const createSearchCondition = (fields, boostFields = []) => {
    return {
      [Op.or]: [
        // Exact phrase match (highest priority)
        ...fields.map(field => ({ [field]: { [Op.like]: `%${q}%` } })),
        
        // Individual term matches in boosted fields
        ...boostFields.flatMap(field => 
          searchTerms.map(term => ({ [field]: { [Op.like]: `%${term}%` } }))
        ),
        
        // Individual term matches in regular fields
        ...fields.flatMap(field => 
          searchTerms.map(term => ({ [field]: { [Op.like]: `%${term}%` } }))
        )
      ]
    };
  };

  // Job search: Boost title and companyName, include description
  whereJob = { 
    ...whereJob, 
    ...createSearchCondition(
      ['title', 'description', 'companyName'], // All searchable fields
      ['title', 'companyName'] // Boosted fields (appear in multiple conditions)
    )
  };

  // Event search
  whereEvent = { 
    ...whereEvent, 
    ...createSearchCondition(['title', 'description'], ['title']) 
  };

  // Service search  
  whereService = { 
    ...whereService, 
    ...createSearchCondition(['title', 'description'], ['title']) 
  };

  // Product search
  whereProduct = { 
    ...whereProduct, 
    ...createSearchCondition(['title', 'description'], ['title']) 
  };

  // Tourism search
  whereTourism = { 
    ...whereTourism, 
    ...createSearchCondition(['title', 'description', 'location'], ['title']) 
  };

  // Funding search (uses pitch instead of description)
  whereFunding = { 
    ...whereFunding, 
    ...createSearchCondition(['title', 'pitch'], ['title']) 
  };

  // Need search
  whereNeed = { 
    ...whereNeed, 
    ...createSearchCondition(['title', 'description'], ['title']) 
  };

  // Moment search
  whereCommon = { 
    ...whereCommon, 
    ...createSearchCondition(['title', 'description'], ['title']) 
  };
}


    if (hasTextSearch) {
  console.log('🔍 Final search conditions:');
  console.log('- Jobs:', Object.keys(whereJob).filter(k => k.includes('Op')));
  console.log('- Events:', Object.keys(whereEvent).filter(k => k.includes('Op')));

}



    if (categoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ categoryId }, { "$audienceCategories.id$": categoryId });
    }
    if (subcategoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ "$audienceSubcategories.id$": subcategoryId });
    }
    if (subsubCategoryId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ "$audienceSubsubs.id$": subsubCategoryId });
    }
    if (identityId) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ "$audienceIdentities.id$": identityId });
    }
    if (effIndustryIds.length > 0) {
      if (!whereFunding[Op.or]) whereFunding[Op.or] = [];
      whereFunding[Op.or].push({ industryCategoryId: { [Op.in]: effIndustryIds } });
    }

    async function getConStatusItems(items) {
      const currentUserId = req.user?.id || null;
      const targetIds = items
        .map((it) =>
          it.kind === "job"
            ? it.postedByUserId
            : it.kind === "event"
            ? it.organizerUserId
            : it.kind === "service"
            ? it.providerUserId
            : it.kind === "product"
            ? it.sellerUserId
            : it.kind === "tourism"
            ? it.authorUserId
            : it.kind === "funding"
            ? it.creatorUserId
            : it.kind === "need"
            ? it.userId
            : it.kind === "moment"
            ? it.userId
            : null
        )
        .filter(Boolean);

        // Get job applications and event registrations status
      const jobIds = items.filter(it => it.kind === 'job').map(job => job.id);
      const eventIds = items.filter(it => it.kind === 'event').map(event => event.id);

      const [statusMap, jobApplicationsMap, eventRegistrationsMap] = await Promise.all([
        getConnectionStatusMap(currentUserId, targetIds, {
          Connection,
          ConnectionRequest,
        }),
        getUserJobApplicationsStatus(currentUserId, jobIds),
        getUserEventRegistrationsStatus(currentUserId, eventIds)
     ]);

      const withStatus = items.map((it) => {
        const ownerId =
          it.kind === "job"
            ? it.postedByUserId
            : it.kind === "event"
            ? it.organizerUserId
            : it.kind === "service"
            ? it.providerUserId
            : it.kind === "product"
            ? it.sellerUserId
            : it.kind === "tourism"
            ? it.authorUserId
            : it.kind === "funding"
            ? it.creatorUserId
            : it.kind === "need"
            ? it.userId
            : it.kind === "moment"
            ? it.userId
            : null;

        
    if (it.kind === 'job') {
      it.applicationStatus = currentUserId ? (jobApplicationsMap[it.id] || 'not_applied') : 'unauthenticated';
    }
   

    if (it.kind === 'event') {
      it.registrationStatus = currentUserId ? (eventRegistrationsMap[it.id] || 'not_registered') : 'unauthenticated';
    }

    return {
      ...it,
      connectionStatus: ownerId
        ? statusMap[ownerId] || (currentUserId ? "none" : "unauthenticated")
        : currentUserId
        ? "none"
        : "unauthenticated",
    };
  });

  return withStatus;
}

    const mapJob = (j, companyMap = null) => {
      const jobData = {

        kind: "job",
        id: j.id,
        title: j.title,
        companyName: j.companyName,
        companyId: j.companyId || null,
        company: j.companyId && companyMap ? companyMap[String(j.companyId)] || null : null,
        jobType: j.jobType,
        categoryId: j.categoryId ? String(j.categoryId) : "",
        categoryName: j.category?.name || "",
        subcategoryId: j.subcategoryId ? String(j.subcategoryId) : "",
        subcategoryName: j.subcategory?.name || "",
        description: j.description,
        city: j.city,
        country: j.country,
        countries: j.countries || [],
        currency: j.currency,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        createdAt: j.createdAt,
        make_company_name_private:j.make_company_name_private,
        timeAgo: timeAgo(j.createdAt),
        postedByUserId: j.postedByUserId || null,
        postedByUserName: j.postedBy?.name || null,
        postedByUserAvatarUrl: j.postedBy?.avatarUrl || j.postedBy?.profile?.avatarUrl || null,
        avatarUrl: j.postedBy?.avatarUrl || j.postedBy?.profile?.avatarUrl || null,
        coverImage: j.coverImage || j.coverImageBase64 || null,
        profile:j.postedBy?.profile || null,
        postedBy:j.postedBy || null,
        audienceCategories: (j.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (j.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (j.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (j.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      jobData.matchPercentage = calculateItemMatchPercentage(jobData);
      return jobData;
    };

    const mapEvent = (e) => {
      const eventData = {
        kind: "event",
        id: e.id,
        title: e.title,
        eventType: e.eventType,
        description: e.description,
        coverImageBase64: e.coverImageBase64,
        _debug_fields: null,
        coverImage: (() => {
          const possibleFields = [
            "coverImage",
            "coverImageBase64",
            "coverImageUrl",
            "overImage",
            "overImageUrl",
            "eventImage",
            "eventCover",
            "image",
            "imageUrl",
          ];
          for (const field of possibleFields) {
            if (e[field]) {
              let value = e[field];
              if (typeof value === "string" && value.startsWith("Url")) value = value.substring(3);
              return value;
            }
          }
          const imageFields = Object.keys(e.dataValues || e).filter(
            (k) =>
              typeof e[k] === "string" &&
              (k.toLowerCase().includes("image") ||
                k.toLowerCase().includes("cover") ||
                k.toLowerCase().includes("photo"))
          );
          if (imageFields.length > 0) {
            let value = e[imageFields[0]];
            if (typeof value === "string" && value.startsWith("Url")) value = value.substring(3);
            return value;
          }
          return null;
        })(),
        images: e.images
          ? typeof e.images === "string"
            ? JSON.parse(e.images || "[]")
            : Array.isArray(e.images)
            ? e.images
            : []
          : [],
        isPaid: e.isPaid,
        price: e.price,
        currency: e.currency,
        categoryId: e.categoryId ? String(e.categoryId) : "",
        categoryName: e.category?.name || "",
        subcategoryId: e.subcategoryId ? String(e.subcategoryId) : "",
        subcategoryName: e.subcategory?.name || "",
        city: e.city,
        profile:e.organizer?.profile || null,
        postedBy:e.organizer || null,
        country: e.country,
        createdAt: e.createdAt,
        timeAgo: timeAgo(e.createdAt),
        organizerUserId: e.organizerUserId || null,
        organizerUserName: e.organizer?.name || null,
        avatarUrl: e.organizer?.avatarUrl || e.organizer?.profile?.avatarUrl || null,
        audienceCategories: (e.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (e.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (e.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (e.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      eventData.matchPercentage = calculateItemMatchPercentage(eventData);
      return eventData;
    };

    function pickServiceCatSub(svc, preferredCatId, preferredSubId) {
      const ints = svc.provider?.interests || [];
      if (!ints.length) return {};
      let hit =
        (preferredSubId &&
          ints.find((i) => String(i.subcategoryId) === String(preferredSubId))) ||
        (preferredCatId && ints.find((i) => String(i.categoryId) === String(preferredCatId))) ||
        ints[0];
      return {
        categoryId: hit?.categoryId ?? null,
        categoryName: hit?.category?.name ?? "",
        subcategoryId: hit?.subcategoryId ?? null,
        subcategoryName: hit?.subcategory?.name ?? "",
      };
    }

    const mapService = (s) => {
      const picked = pickServiceCatSub(s, categoryId, subcategoryId);
      const serviceData = {
        kind: "service",
        id: s.id,
        title: s.title,
        serviceType: s.serviceType,
        description: s.description,
        priceAmount: s.priceAmount,
        priceType: s.priceType,
        deliveryTime: s.deliveryTime,
        locationType: s.locationType,
        experienceLevel: s.experienceLevel,
        images: s.attachments
          ? typeof s.attachments === "string"
            ? JSON.parse(s.attachments || "[]")
            : Array.isArray(s.attachments)
            ? s.attachments
            : []
          : [],
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        city: s.city,
        country: s.country,
        createdAt: s.createdAt,
        timeAgo: timeAgo(s.createdAt),
        providerUserId: s.providerUserId || null,
        providerUserName: s.provider?.name || null,
        profile:s.provider?.profile || null,
        postedBy:s.provider || null,
        avatarUrl: s.provider?.avatarUrl || s.provider?.profile?.avatarUrl || null,
        audienceCategories: (s.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (s.audienceSubcategories || []).map((sub) => ({ id: String(sub.id), name: sub.name })),
        audienceSubsubs: (s.audienceSubsubs || []).map((sub) => ({ id: String(sub.id), name: sub.name })),
        audienceIdentities: (s.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      serviceData.matchPercentage = calculateItemMatchPercentage(serviceData);
      return serviceData;
    };

    function pickProductCatSub(prod, preferredCatId, preferredSubId) {
      const cats = prod.audienceCategories || [];
      const subs = prod.audienceSubcategories || [];
      const subHit =
        (preferredSubId && subs.find((s) => String(s.id) === String(preferredSubId))) || subs[0];
      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }
      const catHit =
        (preferredCatId && cats.find((c) => String(c.id) === String(preferredCatId))) || cats[0];
      if (catHit) {
        return {
          categoryId: catHit.id,
          categoryName: catHit.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }
      return {};
    }

    const mapProduct = (p) => {
      const picked = pickProductCatSub(p, categoryId, subcategoryId);
      let parsedImages = [];
      try {
        if (Array.isArray(p.images)) parsedImages = p.images;
        else if (typeof p.images === "string") parsedImages = JSON.parse(p.images || "[]");
        else if (p.images && typeof p.images === "object") parsedImages = p.images;
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(p.tags)) parsedTags = p.tags;
        else if (typeof p.tags === "string") parsedTags = JSON.parse(p.tags || "[]");
      } catch {}
      const productData = {
        kind: "product",
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        quantity: p.quantity,
        tags: parsedTags,
        images: parsedImages,
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        country: p.country || null,
        city: p.city || null,
        createdAt: p.createdAt,
        timeAgo: timeAgo(p.createdAt),
        profile:p.seller?.profile || null,
        postedBy:p.seller || null,
        sellerUserId: p.sellerUserId || null,
        sellerUserName: p.seller?.name || null,
        avatarUrl: p.seller?.avatarUrl || p.seller?.profile?.avatarUrl || null,
        audienceCategories: (p.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (p.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (p.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (p.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      productData.matchPercentage = calculateItemMatchPercentage(productData);
      return productData;
    };

    function pickTourismCatSub(t, preferredCatId, preferredSubId) {
      const cats = t.audienceCategories || [];
      const subs = t.audienceSubcategories || [];
      const subHit =
        (preferredSubId && subs.find((s) => String(s.id) === String(preferredSubId))) || subs[0];
      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }
      const catHit =
        (preferredCatId && cats.find((c) => String(c.id) === String(preferredCatId))) || cats[0];
      if (catHit) {
        return {
          categoryId: catHit.id,
          categoryName: catHit.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }
      return {};
    }

    const mapTourism = (t) => {
      const picked = pickTourismCatSub(t, categoryId, subcategoryId);
      let parsedImages = [];
      try {
        if (Array.isArray(t.images)) parsedImages = t.images;
        else if (typeof t.images === "string") parsedImages = JSON.parse(t.images || "[]");
        else if (t.images && typeof t.images === "object") parsedImages = t.images;
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(t.tags)) parsedTags = t.tags;
        else if (typeof t.tags === "string") parsedTags = JSON.parse(t.tags || "[]");
      } catch {}
      const tourismData = {
        kind: "tourism",
        id: t.id,
        postType: t.postType,
        title: t.title,
        description: t.description,
        season: t.season || null,
        budgetRange: t.budgetRange || null,
        tags: parsedTags,
        images: parsedImages,
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        location: t.location || null,
        country: t.country || null,
        createdAt: t.createdAt,
        profile:t.author?.profile || null,
        postedBy:t.author || null,
        timeAgo: timeAgo(t.createdAt),
        authorUserId: t.authorUserId || null,
        authorUserName: t.author?.name || null,
        avatarUrl: t.author?.avatarUrl || t.author?.profile?.avatarUrl || null,
        audienceCategories: (t.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (t.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (t.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (t.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      tourismData.matchPercentage = calculateItemMatchPercentage(tourismData);
      return tourismData;
    };

    function pickFundingCatSub(f, preferredCatId, preferredSubId) {
      if (f.category) {
        return {
          categoryId: f.category.id,
          categoryName: f.category.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }
      const cats = f.audienceCategories || [];
      const subs = f.audienceSubcategories || [];
      const subHit =
        (preferredSubId && subs.find((s) => String(s.id) === String(preferredSubId))) || subs[0];
      if (subHit) {
        return {
          categoryId: null,
          categoryName: "",
          subcategoryId: subHit.id,
          subcategoryName: subHit.name,
        };
      }
      const catHit =
        (preferredCatId && cats.find((c) => String(c.id) === String(preferredCatId))) || cats[0];
      if (catHit) {
        return {
          categoryId: catHit.id,
          categoryName: catHit.name,
          subcategoryId: null,
          subcategoryName: "",
        };
      }
      return {};
    }

    const mapFunding = (f) => {
      const picked = pickFundingCatSub(f, categoryId, subcategoryId);
      let parsedImages = [];
      try {
        if (Array.isArray(f.images)) parsedImages = f.images;
        else if (typeof f.images === "string") parsedImages = JSON.parse(f.images || "[]");
        else if (f.images && typeof f.images === "object") parsedImages = f.images;
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(f.tags)) parsedTags = f.tags;
        else if (typeof f.tags === "string") parsedTags = JSON.parse(f.tags || "[]");
      } catch {}
      let parsedLinks = [];
      try {
        if (Array.isArray(f.links)) parsedLinks = f.links;
        else if (typeof f.links === "string") parsedLinks = JSON.parse(f.links || "[]");
      } catch {}
      const fundingData = {
        kind: "funding",
        id: f.id,
        title: f.title,
        pitch: f.pitch,
        goal: f.goal,
        currency: f.currency,
        deadline: f.deadline,
        rewards: f.rewards || null,
        team: f.team || null,
        email: f.email || null,
        phone: f.phone || null,
        status: f.status,
        visibility: f.visibility,
        tags: parsedTags,
        links: parsedLinks,
        raised: f.raised,
        images: parsedImages,
        profile:f.creator?.profile || null,
        postedBy:f.creator || null,
        categoryId: picked.categoryId ? String(picked.categoryId) : "",
        categoryName: picked.categoryName || "",
        subcategoryId: picked.subcategoryId ? String(picked.subcategoryId) : "",
        subcategoryName: picked.subcategoryName || "",
        city: f.city || null,
        country: f.country || null,
        createdAt: f.createdAt,
        timeAgo: timeAgo(f.createdAt),
        creatorUserId: f.creatorUserId || null,
        creatorUserName: f.creator?.name || null,
        avatarUrl: f.creator?.avatarUrl || f.creator?.profile?.avatarUrl || null,
        audienceCategories: (f.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (f.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (f.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (f.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      fundingData.matchPercentage = calculateItemMatchPercentage(fundingData);
      return fundingData;
    };

    const calculateItemMatchPercentage = (item) => {
      if (!currentUserId) {
        const WEIGHTS = { category: 25, subcategory: 25, subsubcategory: 20, goal: 15, identity: 15, location: 20, text: 10, experienceLevel: 10 };
        let totalScore = 0, matchedFactors = 0;
        const itemTaxonomies = {
          categories: (item.audienceCategories || []).map((c) => String(c.id)),
          subcategories: (item.audienceSubcategories || []).map((s) => String(s.id)),
          subsubcategories: (item.audienceSubsubs || []).map((s) => String(s.id)),
          identities: (item.audienceIdentities || []).map((i) => String(i.id)),
          goals: [],
          directCategory: item.categoryId ? String(item.categoryId) : null,
          directSubcategory: item.subcategoryId ? String(item.subcategoryId) : null,
          directSubsubCategory: item.subsubCategoryId ? String(item.subsubCategoryId) : null,
          generalCategory: item.generalCategoryId ? String(item.generalCategoryId) : null,
          generalSubcategory: item.generalSubcategoryId ? String(item.generalSubcategoryId) : null,
          generalSubsubCategory: item.generalSubsubCategoryId ? String(item.generalSubsubCategoryId) : null,
          industryCategory: item.industryCategoryId ? String(item.industryCategoryId) : null,
          industrySubcategory: item.industrySubcategoryId ? String(item.industrySubcategoryId) : null,
          industrySubsubCategory: item.industrySubsubCategoryId ? String(item.industrySubsubCategoryId) : null,
        };
        if (itemTaxonomies.directCategory) itemTaxonomies.categories.push(itemTaxonomies.directCategory);
        if (itemTaxonomies.directSubcategory) itemTaxonomies.subcategories.push(itemTaxonomies.directSubcategory);
        if (itemTaxonomies.directSubsubCategory) itemTaxonomies.subsubcategories.push(itemTaxonomies.directSubsubCategory);
        itemTaxonomies.categories = [...new Set(itemTaxonomies.categories)];
        itemTaxonomies.subcategories = [...new Set(itemTaxonomies.subcategories)];
        itemTaxonomies.subsubcategories = [...new Set(itemTaxonomies.subsubcategories)];
        itemTaxonomies.identities = [...new Set(itemTaxonomies.identities)];
        if (effAudienceCategoryIds.length && itemTaxonomies.categories.length) {
          const catMatches = itemTaxonomies.categories.filter((id) => effAudienceCategoryIds.includes(id));
          if (catMatches.length) {
            const pct = Math.min(1, catMatches.length / effAudienceCategoryIds.length);
            totalScore += WEIGHTS.category * pct; matchedFactors++;
          }
        }
        if (effAudienceSubcategoryIds.length && itemTaxonomies.subcategories.length) {
          const subMatches = itemTaxonomies.subcategories.filter((id) => effAudienceSubcategoryIds.includes(id));
          if (subMatches.length) {
            const pct = Math.min(1, subMatches.length / effAudienceSubcategoryIds.length);
            totalScore += WEIGHTS.subcategory * pct; matchedFactors++;
          }
        }
        if (effAudienceSubsubCategoryIds.length && itemTaxonomies.subsubcategories.length) {
          const xMatches = itemTaxonomies.subsubcategories.filter((id) => effAudienceSubsubCategoryIds.includes(id));
          if (xMatches.length) {
            const pct = Math.min(1, xMatches.length / effAudienceSubsubCategoryIds.length);
            totalScore += WEIGHTS.subsubcategory * pct; matchedFactors++;
          }
        }
        /*if (hasTextSearch) {
          const itemText = [
            item.title,
            item.description,
            item.companyName,
            item.city,
            item.location,
            item.pitch,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const matches = searchTerms.some((term) => itemText.includes(term.toLowerCase()));
          if (matches) {
            totalScore += WEIGHTS.text;
            matchedFactors++;
          }
        }*/


          
          
            

          if (hasTextSearch) {
    const searchText = q.toLowerCase();
    const itemTitle = (item.title || '').toLowerCase();
    
    // Get the correct description field
    let descriptionField = '';
    switch(item.kind) {
      case 'funding':
        descriptionField = item.pitch || '';
        break;
      default:
        descriptionField = item.description || '';
    }
    const itemDesc = descriptionField.toLowerCase();
    
    let textScore = 0;

    // SCORING TIERS:
    
    // Tier 1: EXACT PHRASE MATCHES (Highest priority)
    if (itemTitle.includes(searchText)) {
      textScore += 60; // Exact phrase in title
    } else if (itemDesc.includes(searchText)) {
      textScore += 50; // Exact phrase in description
    }
    
    // Tier 2: MULTIPLE TERM MATCHES
    const matchedTerms = searchTerms.filter(term => {
      const termLower = term.toLowerCase();
      return itemTitle.includes(termLower) || itemDesc.includes(termLower);
    });
    
    if (matchedTerms.length > 0) {
      const coverage = matchedTerms.length / searchTerms.length;
      
      // More terms matched = higher score
      if (coverage >= 0.8) textScore += 45; // 80%+ terms matched
      else if (coverage >= 0.6) textScore += 35; // 60%+ terms matched  
      else if (coverage >= 0.4) textScore += 25; // 40%+ terms matched
      else textScore += 15; // Some terms matched
    }

    // Tier 3: FIELD-SPECIFIC BOOSTS
    searchTerms.forEach(term => {
      const termLower = term.toLowerCase();
      
      // Title matches are very valuable
      if (itemTitle.includes(termLower)) {
        textScore += 8;
      }
      
      // Description matches are valuable but less than title
      if (itemDesc.includes(termLower)) {
        textScore += 5;
      }
      
      // Context-specific boosts
      if (item.kind === 'job') {
        if (item.companyName?.toLowerCase().includes(termLower)) {
          textScore += 6;
        }
        // Boost for job-specific terms
        if (['hire', 'looking', 'need', 'wanted', 'required', 'seeking'].includes(termLower)) {
          textScore += 3;
        }
      }
    });

    // Apply the text score
    totalScore += Math.min(80, textScore);
    
    console.log('🔍 SCORING DEBUG:', {
      kind: item.kind,
      title: item.title?.substring(0, 40),
      textScore,
      totalScore,
      matchedTerms,
      searchTerms
    });
  }



  // RECENCY BOOST (smaller to not override text relevance)
  const daysOld = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (daysOld <= 1) totalScore += 8;
  else if (daysOld <= 7) totalScore += 4;




        let locationScore = 0;
        const itemCity = (item.city || item.location || "").toLowerCase();
        if (cities.length && itemCity) {
          const cityMatches = cities.some(city => itemCity.includes(city.toLowerCase()) || city.toLowerCase().includes(itemCity));
          if (cityMatches) locationScore += 0.4;
        }
        if (countries.length && item.country) {
          if (countries.includes(item.country)) locationScore += 0.6;
        }
        if (locationScore) { totalScore += WEIGHTS.location * locationScore; matchedFactors++; }
        if (experienceLevel) {
          const filteredLevels = experienceLevel.split(",").filter(Boolean);
          if (item.experienceLevel && filteredLevels.includes(item.experienceLevel)) {
            totalScore += WEIGHTS.experienceLevel;
            matchedFactors++;
          }
        }
        if (Array.isArray(effGeneralCategoryIds) && effGeneralCategoryIds.length && itemTaxonomies.generalCategory) {
          if (effGeneralCategoryIds.map(String).includes(itemTaxonomies.generalCategory)) {
            totalScore += 25; matchedFactors++;
          }
        }
        if (Array.isArray(effGeneralSubcategoryIds) && effGeneralSubcategoryIds.length && itemTaxonomies.generalSubcategory) {
          if (effGeneralSubcategoryIds.map(String).includes(itemTaxonomies.generalSubcategory)) {
            totalScore += 30; matchedFactors++;
          }
        }
        if (Array.isArray(effGeneralSubsubCategoryIds) && effGeneralSubsubCategoryIds.length && itemTaxonomies.generalSubsubCategory) {
          if (effGeneralSubsubCategoryIds.map(String).includes(itemTaxonomies.generalSubsubCategory)) {
            totalScore += 20; matchedFactors++;
          }
        }
        if (Array.isArray(effIndustryIds) && effIndustryIds.length && itemTaxonomies.industryCategory) {
          if (effIndustryIds.map(String).includes(itemTaxonomies.industryCategory)) {
            totalScore += 35; matchedFactors++;
          }
        }
        return Math.max(0, Math.min(100, Math.round(totalScore)));
      }

      // New matching logic like people.controller.js with taxonomy validation
      console.log('=== FEED MATCH DEBUG ===');
      console.log('Item:', item.kind, item.id, item.title?.substring(0, 30));
      const itemOfferings = {
        categories: (item.audienceCategories || []).map((c) => String(c.id)),
        subcategories: (item.audienceSubcategories || []).map((s) => String(s.id)),
        subsubcategories: (item.audienceSubsubs || []).map((s) => String(s.id)),
        identities: (item.audienceIdentities || []).map((i) => String(i.id)),
      };
     // console.log('Item offerings:', itemOfferings);
      const postIdentities = itemOfferings.identities;
      const userInterests = {
        categories: userDefaults.interestCategoryIds.map(String).filter(id => checkIfBelongs('category', id, postIdentities)),
        subcategories: userDefaults.interestSubcategoryIds.map(String).filter(id => checkIfBelongs('subcategory', id, postIdentities)),
        subsubcategories: userDefaults.interestSubsubCategoryIds.map(String).filter(id => checkIfBelongs('subsubcategory', id, postIdentities)),
        identities: userDefaults.interestIdentityIds.map(String),
      };
     // console.log('User interests (filtered):', userInterests);


      const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
      let totalScore = 0;
      let totalPossibleScore = 0;
      // Identity matching - one match gives 100%
      if (userInterests.identities.length > 0) {
        const hasMatch = itemOfferings.identities.length > 0 && itemOfferings.identities.some(id => userInterests.identities.includes(id));
        console.log('Identity match:', hasMatch);
        if (hasMatch) {
          totalScore += WEIGHTS.identity;
        }
        totalPossibleScore += WEIGHTS.identity;
      }
      // Category matching - proportion based
      if (userInterests.categories.length > 0) {
        const targetMatches = itemOfferings.categories.filter(id => userInterests.categories.includes(id));
        const pct = Math.min(1, targetMatches.length / Math.max(userInterests.categories.length, itemOfferings.categories.length));
        console.log('Category matches:', targetMatches.length, 'pct:', pct);
        totalScore += WEIGHTS.category * pct;
        totalPossibleScore += WEIGHTS.category;
      }
      // Subcategory matching - proportion based
      if (userInterests.subcategories.length > 0) {
        const targetMatches = itemOfferings.subcategories.filter(id => userInterests.subcategories.includes(id));
        const pct = Math.min(1, targetMatches.length / Math.max(userInterests.subcategories.length, itemOfferings.subcategories.length));
        console.log('Subcategory matches:', targetMatches.length, 'pct:', pct);
        totalScore += WEIGHTS.subcategory * pct;
        totalPossibleScore += WEIGHTS.subcategory;
      }
      // Subsubcategory matching - proportion based
      if (userInterests.subsubcategories.length > 0) {
        const targetMatches = itemOfferings.subsubcategories.filter(id => userInterests.subsubcategories.includes(id));
        const pct = Math.min(1, targetMatches.length / Math.max(userInterests.subsubcategories.length, itemOfferings.subsubcategories.length));
        console.log('Subsubcategory matches:', targetMatches.length, 'pct:', pct);
        totalScore += WEIGHTS.subsubcategory * pct;
        totalPossibleScore += WEIGHTS.subsubcategory;
      }
      // Location matching
      const itemCity = (item.city || item.location || "").toLowerCase();
      let locationScore = 0;
      if (userDefaults.city && itemCity && itemCity === userDefaults.city.toLowerCase()) {
        locationScore = 10 * 0.6;
        totalScore += locationScore;
        totalPossibleScore += 10;
        console.log('Location match: exact city');
      } else if (userDefaults.country && item.country === userDefaults.country) {
        locationScore = 10 * 0.4;
        totalScore += locationScore;
        totalPossibleScore += 10;
        console.log('Location match: country');
      } else {
        console.log('Location match: none');
      }
      if (totalPossibleScore === 0) {
        console.log('No possible score, returning 0');
        return 0;
      }
      const percentage = Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100)));
      console.log('Total score:', totalScore, 'Total possible:', totalPossibleScore, 'Percentage:', percentage);
      console.log('=== END FEED MATCH DEBUG ===');
      return percentage;
    };


    const mapNeed = (n) => {
      const needData = {
        kind: "need",
        id: n.id,
        title: n.title,
        description: n.description,
        budget: n.budget,
        urgency: n.urgency,
        location: n.location,
        categoryId: n.generalCategoryId ? String(n.generalCategoryId) : "",
        categoryName: n.generalCategory?.name || "",
        subcategoryId: n.generalSubcategoryId ? String(n.generalSubcategoryId) : "",
        subcategoryName: n.generalSubcategory?.name || "",
        subsubCategoryId: n.generalSubsubCategoryId ? String(n.generalSubsubCategoryId) : "",
        subsubCategoryName: n.generalSubsubCategory?.name || "",
        city: n.city,
        relatedEntityType:n.relatedEntityType,
        country: n.country,
        createdAt: n.createdAt,
        timeAgo: timeAgo(n.createdAt),
        userId: n.userId || null,
        userName: n.user?.name || null,
        tags:n.criteria,
        profile:n.user?.profile || null,
        postedBy:n.user || null,
        userAvatarUrl: n.user?.avatarUrl || n.user?.profile?.avatarUrl || null,
        attachments: n.attachments
          ? typeof n.attachments === "string"
            ? JSON.parse(n.attachments || "[]")
            : Array.isArray(n.attachments)
            ? n.attachments
            : []
          : [],
        audienceCategories: (n.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (n.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (n.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (n.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
  
      needData.matchPercentage = calculateItemMatchPercentage(needData);
  
      return needData;
    };

    const mapMoment = (m) => {
      const picked = m;
      const user = picked.user || {};
      let parsedImages = [];
      try {
        if (Array.isArray(picked.images)) parsedImages = picked.images;
        else if (typeof picked.images === "string") parsedImages = JSON.parse(picked.images || "[]");
      } catch {}
      let parsedTags = [];
      try {
        if (Array.isArray(picked.tags)) parsedTags = picked.tags;
        else if (typeof picked.tags === "string") parsedTags = JSON.parse(picked.tags || "[]");
      } catch {}
      const momentData = {
        kind: "moment",
        id: m.id,
        title: m.title,
        description: m.description,
        type: m.type,
        date: m.date,
        location: m.location,
        country: m.country,
        city: m.city,
        tags: parsedTags,
        images: parsedImages,
        categoryId: picked.generalCategoryId ? String(picked.generalCategoryId) : "",
        categoryName: picked.generalCategory?.name || "",
        subcategoryId: picked.generalSubcategoryId ? String(picked.generalSubcategoryId) : "",
        subcategoryName: picked.generalSubcategory?.name || "",
        subsubCategoryId: picked.generalSubsubCategoryId ? String(picked.generalSubsubCategoryId) : "",
        subsubCategoryName: picked.generalSubsubCategory?.name || "",
        createdAt: m.createdAt,
        timeAgo: timeAgo(m.createdAt),
        relatedEntityType:m.relatedEntityType,
        userId: m.userId || null,
        userName: user.name || null,
        profile:user?.profile || null,
        postedBy:user || null,
        avatarUrl: user.avatarUrl || user.profile?.avatarUrl || null,
        audienceCategories: (m.audienceCategories || []).map((c) => ({ id: String(c.id), name: c.name })),
        audienceSubcategories: (m.audienceSubcategories || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceSubsubs: (m.audienceSubsubs || []).map((s) => ({ id: String(s.id), name: s.name })),
        audienceIdentities: (m.audienceIdentities || []).map((i) => ({ id: String(i.id), name: i.name })),
      };
      momentData.matchPercentage = calculateItemMatchPercentage(momentData);
      return momentData;
    };

    const interestCatSet = new Set(userDefaults.interestCategoryIds || []);
    const interestSubSet = new Set(userDefaults.interestSubcategoryIds || []);
    const interestXSet = new Set(userDefaults.interestSubsubCategoryIds || []);
    const interestIdSet = new Set(userDefaults.interestIdentityIds || []);
    const attrCatSet = new Set(userDefaults.attributeCategoryIds || []);
    const attrSubSet = new Set(userDefaults.attributeSubcategoryIds || []);
    const attrXSet = new Set(userDefaults.attributeSubsubCategoryIds || []);
    const attrIdSet = new Set(userDefaults.attributeIdentityIds || []);
    const userCity = (userDefaults.city || "").toLowerCase();
    const userCountry = userDefaults.country || null;

    const Wscore = {
      interestX: 50,
      interestSub: 40,
      interestCat: 30,
      interestId: 20,
      attrX: 5,
      attrSub: 4,
      attrCat: 3,
      attrId: 2.5,
      exactCity: 2,
      partialCity: 1,
      country: 1,
      completeness: 0.5,
      recency: 2,
    };

    const scoreItem = (x) => {
      let s = 0;
      const subId = String(x.subcategoryId || "");
      const catId = String(x.categoryId || "");
      const xId = String(x.subsubcategoryId || "");
      const audienceCatIds = (x.audienceCategories || []).map((c) => String(c.id)).filter(Boolean);
      const audienceSubIds = (x.audienceSubcategories || []).map((c) => String(c.id)).filter(Boolean);
      const audienceXIds = (x.audienceSubsubs || []).map((c) => String(c.id)).filter(Boolean);
      const audienceIdIds = (x.audienceIdentities || []).map((c) => String(c.id)).filter(Boolean);
      const allCatIds = catId ? [catId, ...audienceCatIds] : audienceCatIds;
      const allSubIds = subId ? [subId, ...audienceSubIds] : audienceSubIds;
      const allXIds = xId ? [xId, ...audienceXIds] : audienceXIds;
      let hasInterestMatch = false;
      if (interestCatSet.size > 0) {
        const catMatches = allCatIds.filter((id) => interestCatSet.has(id));
        if (catMatches.length > 0) { s += Wscore.interestCat * 2; hasInterestMatch = true; }
      }
      if (interestSubSet.size > 0) {
        const subMatches = allSubIds.filter((id) => interestSubSet.has(id));
        if (subMatches.length > 0) { s += Wscore.interestSub; hasInterestMatch = true; }
      }
      if (interestXSet.size > 0) {
        const xMatches = allXIds.filter((id) => interestXSet.has(id));
        if (xMatches.length > 0) { s += Wscore.interestX; hasInterestMatch = true; }
      }
      if (interestIdSet.size > 0) {
        const idMatches = audienceIdIds.filter((id) => interestIdSet.has(id));
        if (idMatches.length > 0) { s += Wscore.interestId; hasInterestMatch = true; }
      }
      if (hasInterestMatch) s += 100;
      if (attrXSet.size > 0 && allXIds.some((id) => attrXSet.has(id))) s += Wscore.attrX;
      if (attrSubSet.size > 0 && allSubIds.some((id) => attrSubSet.has(id))) s += Wscore.attrSub;
      if (attrCatSet.size > 0 && allCatIds.some((id) => attrCatSet.has(id))) s += Wscore.attrCat;
      if (attrIdSet.size > 0 && audienceIdIds.some((id) => attrIdSet.has(id))) s += Wscore.attrId;
      if (hasTextSearch && x._textMatch) s += 5;
      if (catId && subId) s += Wscore.completeness;
      if (catId && subId && xId) s += Wscore.completeness;
      const itemCity = (x.city || x.location || "").toLowerCase();
      if (userCity && itemCity && itemCity === userCity) s += Wscore.exactCity;
      else if (userCity && itemCity && (itemCity.includes(userCity) || userCity.includes(itemCity)) && itemCity !== userCity) s += Wscore.partialCity;
      if (userCountry && x.country === userCountry) s += Wscore.country;
      const now = new Date();
      const itemDate = new Date(x.createdAt);
      const daysDiff = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 14) s += Wscore.recency * (1 - daysDiff / 14);
      return s;
    };

    if (!currentUserId) {
      if (tab === "events") {
        const events = await Event.findAll({
          subQuery: false,
          where: { ...whereEvent, moderation_status: "approved" },
          include: includeEventRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const eventsWithAudience = await lazyLoadEventAudienceData(events, currentUserId);
        const eventsFiltered = filterByAudienceCriteria(eventsWithAudience, effAudienceIdentityIds, effAudienceCategoryIds, effAudienceSubcategoryIds, effAudienceSubsubCategoryIds);
         // Only show related needs/moments if no incompatible filters

         let relatedNeeds = [];
         let relatedMomentsRows = []

        if (!hasIncompatibleFilters) {
          relatedNeeds = await Need.findAll({
            subQuery: false,
            where: { ...whereNeed, relatedEntityType: 'event', moderation_status: "approved" },
            include: includeNeedRefs,
            order: [["createdAt", "DESC"]],
            limit: lim,
            offset: off,
          });
          relatedMomentsRows = await fetchMomentsPaged({
            where: { ...whereCommon, relatedEntityType: "event" },
            include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
            limit: lim,
            offset: off,
          });
        }

        const mappedEvents = eventsFiltered.map(mapEvent);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const combined = [...mappedEvents, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return { items: await getConStatusItems(filtered) };
      }

      if (tab === "jobs") {
        const jobsViewOptions = jobsView ? ensureArray(jobsView) : [];
        const showJobOffers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Offers");
        const showJobSeekers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Seekers");
        let jobs = [];
        let relatedNeeds = [];
        let relatedMomentsRows = [];
        if (showJobOffers) {
          jobs = await Job.findAll({
            subQuery: false,
            where: { ...whereJob, moderation_status: "approved" },
            include: includeCategoryRefs,
            order: [["createdAt", "DESC"]],
            limit: lim,
            offset: off,
          });
          jobs = await lazyLoadJobAudienceData(jobs, currentUserId);
          // Apply audience filters for unauthenticated users too
          jobs = filterByAudienceCriteria(
            jobs,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          );
        }
        if (showJobSeekers && !hasIncompatibleFilters) {
          relatedNeeds = await Need.findAll({
            subQuery: false,
            where: { ...whereNeed, relatedEntityType: 'job', moderation_status: "approved" },
            include: includeNeedRefs,
            order: [["createdAt", "DESC"]],
            limit: lim,
            offset: off,
          });
          // Load audience for needs and filter by audience params
          relatedNeeds = await lazyLoadNeedAudienceData(relatedNeeds, currentUserId);
          relatedNeeds = filterByAudienceCriteria(
            relatedNeeds,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          );

          if(showJobOffers && showJobSeekers){
             relatedMomentsRows = await fetchMomentsPaged({
            where: { ...whereCommon, relatedEntityType: "job" },
            include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
            limit: lim,
            offset: off,
          });
          
          }
          // Load audience for moments and filter by audience params
          relatedMomentsRows = await lazyLoadMomentAudienceData(relatedMomentsRows, currentUserId);
          relatedMomentsRows = filterByAudienceCriteria(
            relatedMomentsRows,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          );
        }
        const companyMap = await makeCompanyMapById(jobs.map((j) => j.companyId));
        const mappedJobs = jobs.map((j) => mapJob(j, companyMap));
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedJobs, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return { items: await getConStatusItems(filtered) };
      }

      if (tab === "services") {
        const services = await Service.findAll({
          distinct: true,
          col: "Service.id",
          subQuery: false,
          where: { ...whereService, moderation_status: "approved" },
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const servicesWithAudience = await lazyLoadServiceAudienceData(services, currentUserId);
        const servicesFiltered = filterByAudienceCriteria(servicesWithAudience, effAudienceIdentityIds, effAudienceCategoryIds, effAudienceSubcategoryIds, effAudienceSubsubCategoryIds);
       
        let relatedMomentsRows=[]
        let relatedNeeds = []
       
        if(!hasIncompatibleFilters){
           relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'service', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
         relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "service" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        }

        const mappedServices = servicesFiltered.map(mapService);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedServices, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return { items: await getConStatusItems(filtered) };
      }

      if (tab === "products") {
        const products = await Product.findAll({
          subQuery: false,
          where: { ...whereProduct, moderation_status: "approved" },
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const productsWithAudience = await lazyLoadProductAudienceData(products, currentUserId);
        const productsFiltered = filterByAudienceCriteria(productsWithAudience, effAudienceIdentityIds, effAudienceCategoryIds, effAudienceSubcategoryIds, effAudienceSubsubCategoryIds);
          let relatedNeeds = [];
      let relatedMomentsRows = []

      
       if(!hasIncompatibleFilters){
          
        relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'product', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "product" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
       }
        const mappedProducts = productsFiltered.map(mapProduct);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedProducts, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return { items: await getConStatusItems(filtered) };
      }

      if (tab === "tourism") {
        const tourism = await Tourism.findAll({
          subQuery: false,
          where: { ...whereTourism, moderation_status: "approved" },
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const tourismWithAudience = await lazyLoadTourismAudienceData(tourism, currentUserId);
        const tourismFiltered = filterByAudienceCriteria(tourismWithAudience, effAudienceIdentityIds, effAudienceCategoryIds, effAudienceSubcategoryIds, effAudienceSubsubCategoryIds);
        
          let relatedNeeds = [];
      let relatedMomentsRows = []

     
       if(!hasIncompatibleFilters){
         
        relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'tourism', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "tourism" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
       }
        const mappedTourism = tourismFiltered.map(mapTourism);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedTourism, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return { items: await getConStatusItems(filtered) };
      }

      if (tab === "funding") {
        const funding = await Funding.findAll({
          subQuery: false,
          where: { ...whereFunding, moderation_status: "approved" },
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        const fundingWithAudience = await lazyLoadFundingAudienceData(funding, currentUserId);
        const fundingFiltered = filterByAudienceCriteria(
          fundingWithAudience,
          effAudienceIdentityIds,
          effAudienceCategoryIds,
          effAudienceSubcategoryIds,
          effAudienceSubsubCategoryIds
        );

         let relatedNeeds = [];
        let relatedMomentsRows = []

       if(!hasIncompatibleFilters){
         relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'funding', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "funding" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
       }
        const mappedFunding = fundingFiltered.map(mapFunding);
        const mappedNeeds = relatedNeeds.map(mapNeed);
        const mappedMoments = relatedMomentsRows.map(mapMoment);
        const combined = [...mappedFunding, ...mappedNeeds, ...mappedMoments];
        const filtered = applyContentTypeFilter(combined, contentType);
        sortByMatchThenRecency(filtered);
        return { items: await getConStatusItems(filtered) };
      }
if (tab === "needs") {
  const needs = await Need.findAll({
    subQuery: false,
    where: { ...whereNeed, moderation_status: "approved" },
    include: includeNeedRefs,
    order: [["createdAt", "DESC"]],
    limit: lim,
    offset: off,
  });
  let needsWithAudience = await lazyLoadNeedAudienceData(needs, currentUserId);
  needsWithAudience = filterByAudienceCriteria(
    needsWithAudience,
    effAudienceIdentityIds,
    effAudienceCategoryIds,
    effAudienceSubcategoryIds,
    effAudienceSubsubCategoryIds
  );

  const relatedMomentsRows = await fetchMomentsPaged({
    where: { ...whereCommon, relatedEntityType: "need" },
    include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
    limit: lim,
    offset: off,
  });
  let momentsWithAudience = await lazyLoadMomentAudienceData(relatedMomentsRows, currentUserId);
  momentsWithAudience = filterByAudienceCriteria(
    momentsWithAudience,
    effAudienceIdentityIds,
    effAudienceCategoryIds,
    effAudienceSubcategoryIds,
    effAudienceSubsubCategoryIds
  );

  const mappedNeeds = needsWithAudience.map(mapNeed);
  const mappedMoments = momentsWithAudience.map(mapMoment);
  const combined = [...mappedNeeds, ...mappedMoments];
  const filtered = applyContentTypeFilter(combined, contentType);
  sortByMatchThenRecency(filtered);
  return { items: await getConStatusItems(filtered) };
}
      if (tab === "moments") {
        const momentsRows = await fetchMomentsPaged({
          where: { ...whereCommon },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
        let momentsWithAudience = await lazyLoadMomentAudienceData(momentsRows, currentUserId);
        momentsWithAudience = filterByAudienceCriteria(
          momentsWithAudience,
          effAudienceIdentityIds,
          effAudienceCategoryIds,
          effAudienceSubcategoryIds,
          effAudienceSubsubCategoryIds
        );
  
        const mapped = applyContentTypeFilter(momentsWithAudience.map(mapMoment), contentType);
        sortByMatchThenRecency(mapped);
        return { items: await getConStatusItems(mapped) };
      }
      
       
        const promises=await Promise.all([
        (async () => {
          const jobs = await Job.findAll({
            subQuery: false,
            where: { ...whereJob, moderation_status: "approved" },
            include: includeCategoryRefs,
            order: [["createdAt", "DESC"]],
            limit: lim,
          });
          return await lazyLoadJobAudienceData(jobs, currentUserId);
        })(),
        (async () => {
          const events = await Event.findAll({
            subQuery: false,
            where: { ...whereEvent, moderation_status: "approved" },
            include: includeEventRefs,
            order: [["createdAt", "DESC"]],
            limit: lim,
          });
          return await lazyLoadEventAudienceData(events, currentUserId);
        })(),
        (async () => {
          const services = await Service.findAll({
            distinct: true,
            col: "Service.id",
            subQuery: false,
            where: { ...whereService, moderation_status: "approved" },
            include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
            order: [["createdAt", "DESC"]],
            limit: lim,
          });
          return await lazyLoadServiceAudienceData(services, currentUserId);
        })(),
        (async () => {
          const products = await Product.findAll({
            subQuery: false,
            where: { ...whereProduct, moderation_status: "approved" },
            include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
            order: [["createdAt", "DESC"]],
            limit: lim,
          });
          return await lazyLoadProductAudienceData(products, currentUserId);
        })(),
        (async () => {
          const tourism = await Tourism.findAll({
            subQuery: false,
            where: { ...whereTourism, moderation_status: "approved" },
            include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
            order: [["createdAt", "DESC"]],
            limit: lim,
          });
          return await lazyLoadTourismAudienceData(tourism, currentUserId);
        })(),
         (async () => {
          const funding = await Funding.findAll({
            subQuery: false,
            where: categoryId ? { ...whereFunding, categoryId, moderation_status: "approved" } : { ...whereFunding, moderation_status: "approved" },
            include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
            order: [["createdAt", "DESC"]],
            limit: lim,
          });
          return await lazyLoadFundingAudienceData(funding, currentUserId);
        })(),
      
      ]);

      
    // Only fetch Needs and Moments if no incompatible filters
    if (!hasIncompatibleFilters) {
      promises.push(
        Need.findAll({
          subQuery: false,
          where: { ...whereNeed, moderation_status: "approved" },
          include: includeNeedRefs,
          limit: lim,
        }),
        fetchMomentsPaged({
          where: { ...whereCommon },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: 0,
        })
      );
    } else {
      // Return empty arrays for Needs and Moments
      promises.push(Promise.resolve([]), Promise.resolve([]));
    }

   
    const [
      jobsAll,
      eventsAll,
      servicesAll,
      productsAll,
      tourismAll,
      fundingAll,
      needsAll,
      momentsAll,
    ] = await Promise.all(promises);

      const applyTextMatchFlag = (items) => {
        if (!hasTextSearch) return items;
        return items.map((item) => {
          const itemText = [
            item.title,
            item.description,
            item.companyName,
            item.city,
            item.location,
            item.pitch,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          const matches = searchTerms.some((term) => itemText.includes(term.toLowerCase()));
          return { ...item, _textMatch: matches };
        });
      };

      const companyMap = await makeCompanyMapById(jobsAll.map((j) => j.companyId));

      const merged = [
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            jobsAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map((j) => mapJob(j, companyMap))
        ),
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            eventsAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map(mapEvent)
        ),
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            servicesAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map(mapService)
        ),
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            productsAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map(mapProduct)
        ),
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            tourismAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map(mapTourism)
        ),
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            fundingAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map(mapFunding)
        ),
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            needsAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map(mapNeed)
        ),
        ...applyTextMatchFlag(
          filterByAudienceCriteria(
            momentsAll,
            effAudienceIdentityIds,
            effAudienceCategoryIds,
            effAudienceSubcategoryIds,
            effAudienceSubsubCategoryIds
          ).map(mapMoment)
        ),
      ];

    

      sortByMatchThenRecency(merged);
      const diversified = diversifyFeed(merged, { maxSeq: 1 });
      const windowed = diversified.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    const bufferFactor = 2;
    const bufferLimit = lim * bufferFactor;

    if (tab === "events") {
      const events = await Event.findAll({
        subQuery: false,
        where: { ...whereEvent, moderation_status: "approved" },
        include: includeEventRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const eventsWithAudience = await lazyLoadEventAudienceData(events, currentUserId);

      let relatedNeeds = [];
      let relatedMomentsRows = []

      if(!hasIncompatibleFilters){
         relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "event", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "event" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });
      }
      const mappedEvents = eventsWithAudience.map(mapEvent);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);
      const combined = [...mappedEvents, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    if (tab === "jobs") {
      const jobsViewOptions = jobsView ? ensureArray(jobsView) : [];
      const showJobOffers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Offers");
      const showJobSeekers = jobsViewOptions.length === 0 || jobsViewOptions.includes("Job Seekers");

      let jobs = [];
      let relatedNeeds = [];
      let relatedMomentsRows = [];

      if (showJobOffers) {
        jobs = await Job.findAll({
          subQuery: false,
          where: { ...whereJob, moderation_status: "approved" },
          include: includeCategoryRefs,
          order: [["createdAt", "DESC"]],
          limit: bufferLimit,
        });
        jobs = await lazyLoadJobAudienceData(jobs, currentUserId);
        jobs = filterByAudienceCriteria(jobs, effAudienceIdentityIds, effAudienceCategoryIds, effAudienceSubcategoryIds, effAudienceSubsubCategoryIds);
      }

      if (showJobSeekers && !hasIncompatibleFilters) {
        relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: "job", moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: bufferLimit,
        });
        // Load audience data for needs and filter by provided audience params
        relatedNeeds = await lazyLoadNeedAudienceData(relatedNeeds, currentUserId);
        relatedNeeds = filterByAudienceCriteria(
          relatedNeeds,
          effAudienceIdentityIds,
          effAudienceCategoryIds,
          effAudienceSubcategoryIds,
          effAudienceSubsubCategoryIds
        );

         if(showJobOffers && showJobSeekers){
              relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "job" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: bufferLimit,
          offset: 0,
        });
         }

       
        // Load audience data for moments and filter by provided audience params
        relatedMomentsRows = await lazyLoadMomentAudienceData(relatedMomentsRows, currentUserId);
        relatedMomentsRows = filterByAudienceCriteria(
          relatedMomentsRows,
          effAudienceIdentityIds,
          effAudienceCategoryIds,
          effAudienceSubcategoryIds,
          effAudienceSubsubCategoryIds
        );
      }

      const companyMap = await makeCompanyMapById(jobs.map((j) => j.companyId));
      const mappedJobs = jobs.map((j) => mapJob(j, companyMap));
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);
      const combined = [...mappedJobs, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    if (tab === "services") {
      const services = await Service.findAll({
        distinct: true,
        col: "Service.id",
        subQuery: false,
        where: { ...whereService, moderation_status: "approved" },
        include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const servicesWithAudience = await lazyLoadServiceAudienceData(services, currentUserId);

       let relatedMomentsRows=[]
        let relatedNeeds = []
       // Only show related needs/moments if no incompatible filters
      if (!hasIncompatibleFilters) {
        relatedNeeds = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, relatedEntityType: 'service', moderation_status: "approved" },
          include: includeNeedRefs,
          order: [["createdAt", "DESC"]],
          limit: lim,
          offset: off,
        });
        relatedMomentsRows = await fetchMomentsPaged({
          where: { ...whereCommon, relatedEntityType: "service" },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: lim,
          offset: off,
        });
      }


      const mappedServices = servicesWithAudience.map(mapService);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedServices, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    if (tab === "products") {
      const products = await Product.findAll({
        subQuery: false,
        where: { ...whereProduct, moderation_status: "approved" },
        include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const productsWithAudience = await lazyLoadProductAudienceData(products, currentUserId);

      let relatedNeeds = [];
      let relatedMomentsRows = []



     if(!hasIncompatibleFilters){
        relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "product", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "product" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });
     }

      const mappedProducts = productsWithAudience.map(mapProduct);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedProducts, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    if (tab === "tourism") {
      const tourism = await Tourism.findAll({
        subQuery: false,
        where: { ...whereTourism, moderation_status: "approved" },
        include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });
      const tourismWithAudience = await lazyLoadTourismAudienceData(tourism, currentUserId);


      let relatedNeeds = [];
      let relatedMomentsRows = []

      if(!hasIncompatibleFilters){
        
          relatedNeeds = await Need.findAll({
            subQuery: false,
            where: { ...whereNeed, relatedEntityType: "tourism", moderation_status: "approved" },
            include: includeNeedRefs,
            order: [["createdAt", "DESC"]],
            limit: bufferLimit,
          });

          relatedMomentsRows = await fetchMomentsPaged({
            where: { ...whereCommon, relatedEntityType: "tourism" },
            include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
            limit: bufferLimit,
            offset: 0,
          });

      }
      const mappedTourism = tourismWithAudience.map(mapTourism);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedTourism, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    if (tab === "funding") {
      const funding = await Funding.findAll({
        subQuery: false,
        where: { ...whereFunding, moderation_status: "approved" },
        include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const fundingWithAudience= await lazyLoadFundingAudienceData(funding, currentUserId);
      const fundingFiltered = filterByAudienceCriteria(fundingWithAudience, effAudienceIdentityIds, effAudienceCategoryIds, effAudienceSubcategoryIds, effAudienceSubsubCategoryIds);

      let relatedNeeds = [];
      let relatedMomentsRows = []

     
      if(!hasIncompatibleFilters){
         relatedNeeds = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, relatedEntityType: "funding", moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "funding" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      }
      const mappedFunding = fundingWithAudience.map(mapFunding);
      const mappedNeeds = relatedNeeds.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedFunding, ...mappedNeeds, ...mappedMoments];
      combined.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(combined);
      const windowed = combined.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    if (tab === "needs") {
      const needs = await Need.findAll({
        subQuery: false,
        where: { ...whereNeed, moderation_status: "approved" },
        include: includeNeedRefs,
        order: [["createdAt", "DESC"]],
        limit: bufferLimit,
      });

      const relatedMomentsRows = await fetchMomentsPaged({
        where: { ...whereCommon, relatedEntityType: "need" },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedNeeds = needs.map(mapNeed);
      const mappedMoments = relatedMomentsRows.map(mapMoment);

      const combined = [...mappedNeeds, ...mappedMoments];
      const filtered = applyContentTypeFilter(combined, contentType);
      filtered.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(filtered);
      const windowed = filtered.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    if (tab === "moments") {
      const momentsRows = await fetchMomentsPaged({
        where: { ...whereCommon },
        include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
        limit: bufferLimit,
        offset: 0,
      });

      const mappedMoments = momentsRows.map(mapMoment);
      const filtered = applyContentTypeFilter(mappedMoments, contentType);
      filtered.forEach((x) => (x._score = scoreItem(x)));
      sortByMatchThenRecency(filtered);
      const windowed = filtered.slice(off, off + lim);
      return { items: await getConStatusItems(windowed) };
    }

    const [
      jobsBuf,
      eventsBuf,
      servicesBuf,
      productsBuf,
      tourismBuf,
      fundingBuf,
      needsBuf,
      momentsBuf,
    ] = await Promise.all([
      (async () => {
        const jobs = await Job.findAll({
          subQuery: false,
          where: { ...whereJob, moderation_status: "approved" },
          include: includeCategoryRefs,
          limit: bufferLimit,
        });
        return await lazyLoadJobAudienceData(jobs, currentUserId);
      })(),
      (async () => {
        const events = await Event.findAll({
          subQuery: false,
          where: { ...whereEvent, moderation_status: "approved" },
          include: includeEventRefs,
          limit: bufferLimit,
        });
        return await lazyLoadEventAudienceData(events, currentUserId);
      })(),
      (async () => {
        const services = await Service.findAll({
          distinct: true,
          col: "Service.id",
          subQuery: false,
          where: { ...whereService, moderation_status: "approved" },
          include: makeServiceInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: bufferLimit,
        });
        return await lazyLoadServiceAudienceData(services, currentUserId);
      })(),
      (async () => {
        const products = await Product.findAll({
          subQuery: false,
          where: { ...whereProduct, moderation_status: "approved" },
          include: makeProductInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: bufferLimit,
        });
        return await lazyLoadProductAudienceData(products, currentUserId);
      })(),
      (async () => {
        const tourism = await Tourism.findAll({
          subQuery: false,
          where: { ...whereTourism, moderation_status: "approved" },
          include: makeTourismInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: bufferLimit,
        });
        return await lazyLoadTourismAudienceData(tourism, currentUserId);
      })(),
      (async () => {
        const funding = await Funding.findAll({
          subQuery: false,
          where: { ...whereFunding, moderation_status: "approved" },
          include: makeFundingInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: bufferLimit,
        });
        return await lazyLoadFundingAudienceData(funding, currentUserId);
      })(),
      (async () => {
        const needs = await Need.findAll({
          subQuery: false,
          where: { ...whereNeed, moderation_status: "approved" },
          include: includeNeedRefs,
          limit: bufferLimit,
        });
        return await lazyLoadNeedAudienceData(needs, currentUserId);
      })(),
      (async () => {
        const moments = await fetchMomentsPaged({
          where: { ...whereCommon },
          include: makeMomentInclude({ categoryId, subcategoryId, subsubCategoryId }),
          limit: bufferLimit,
          offset: 0,
        });
        return await lazyLoadMomentAudienceData(moments, currentUserId);
      })(),
    ]);

    const applyTextMatchFlag = (items) => {
      if (!hasTextSearch) return items;
      return items.map((item) => {
        const itemText = [
          item.title,
          item.description,
          item.companyName,
          item.city,
          item.location,
          item.pitch,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matches = searchTerms.some((term) => itemText.includes(term.toLowerCase()));
        return { ...item, _textMatch: matches };
      });
    };

    const companyMap2 = await makeCompanyMapById(jobsBuf.map((j) => j.companyId));

    const mergedScored = [
      ...applyTextMatchFlag(jobsBuf.map((j) => mapJob(j, companyMap2))),
      ...applyTextMatchFlag(eventsBuf.map(mapEvent)),
      ...applyTextMatchFlag(servicesBuf.map(mapService)),
      ...applyTextMatchFlag(productsBuf.map(mapProduct)),
      ...applyTextMatchFlag(tourismBuf.map(mapTourism)),
      ...applyTextMatchFlag(fundingBuf.map(mapFunding)),
      ...applyTextMatchFlag(needsBuf.map(mapNeed)),
      ...applyTextMatchFlag(momentsBuf.map(mapMoment)),
    ];

    const contentFiltered = applyContentTypeFilter(mergedScored, contentType);
    const scored = contentFiltered.map((x) => ({ ...x, _score: scoreItem(x) }));
    sortByMatchThenRecency(scored);
    const diversified = diversifyFeed(scored, { maxSeq: 1 });
    const windowed = diversified.slice(off, off + lim);
    return { items: await getConStatusItems(windowed) };
    }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get feed" });
  }
};






exports.getSuggestions = async (req, res) => {
  try {
    const {
      q,
      country: qCountry,
      city: qCity,
      categoryId,
      cats,
      subcategoryId,
      bidirectionalMatch,
      bidirectionalMatchFormula,
      limit = 10,
    } = req.query;

    const like = (v) => ({ [Op.like]: `%${v}%` });

    const currentUserId = req.user?.id || null;

    // Set default values for matching configuration
    let userBidirectionalMatch = bidirectionalMatch !== undefined ? bidirectionalMatch : true;
    let userBidirectionalMatchFormula = bidirectionalMatchFormula || "reciprocal";

    // Load user settings for matching configuration if not provided in query and user is logged in
    if (currentUserId && (bidirectionalMatch === undefined || bidirectionalMatchFormula === undefined)) {
      try {
        const userSettings = await UserSettings.findOne({
          where: { userId: currentUserId },
          attributes: ['bidirectionalMatch', 'bidirectionalMatchFormula']
        });

        if (userSettings) {
          if (bidirectionalMatch === undefined) {
            userBidirectionalMatch = userSettings.bidirectionalMatch;
          }
          if (bidirectionalMatchFormula === undefined) {
            userBidirectionalMatchFormula = userSettings.bidirectionalMatchFormula;
          }
        }
      } catch (error) {
        console.error("Error loading user settings for matching configuration:", error);
      }
    }

    let userDefaults = {
      country: null,
      city: null,
      categoryIds: [],
      subcategoryIds: [],
      subsubcategoryIds: [],
      identityIds: [],
      interestCategoryIds: [],
      interestSubcategoryIds: [],
      interestSubsubCategoryIds: [],
      interestIdentityIds: [],
    };

    if (currentUserId) {
      try {
        const me = await User.findByPk(currentUserId, {
          attributes: ["id", "country", "city", "accountType"],
          include: [
            { 
              model: UserCategory, 
              as: "interests", 
              attributes: ["categoryId", "subcategoryId"] 
            },
            { 
              model: UserSubcategory, 
              as: "userSubcategories", 
              attributes: ["subcategoryId"],
              include: [{ model: Subcategory, as: "subcategory", attributes: ["id"] }]
            },
            { 
              model: UserSubsubCategory, 
              as: "userSubsubCategories", 
              attributes: ["subsubCategoryId"],
              include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id"] }]
            },
            { 
              model: Goal, 
              as: "goals", 
              attributes: ["id"] 
            },
            { 
              model: Identity, 
              as: "identities", 
              attributes: ["id"], 
              through: { attributes: [] } 
            },
            { 
              model: UserIdentityInterest, 
              as: "identityInterests", 
              attributes: ["identityId"], 
              include: [{ model: Identity, as: "identity", attributes: ["id"] }] 
            },
            { 
              model: UserCategoryInterest, 
              as: "categoryInterests", 
              attributes: ["categoryId"], 
              include: [{ model: Category, as: "category", attributes: ["id"] }] 
            },
            { 
              model: UserSubcategoryInterest, 
              as: "subcategoryInterests", 
              attributes: ["subcategoryId"], 
              include: [{ model: Subcategory, as: "subcategory", attributes: ["id"] }] 
            },
            { 
              model: UserSubsubCategoryInterest, 
              as: "subsubInterests", 
              attributes: ["subsubCategoryId"], 
              include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id"] }] 
            },
          ],
        });
        
        if (me) {
          userDefaults.country = me.country || null;
          userDefaults.city = me.city || null;
          
          // Load all interest types properly
          userDefaults.categoryIds = (me.interests || []).map((i) => i.categoryId).filter(Boolean);
          userDefaults.subcategoryIds = (me.userSubcategories || []).map((i) => i.subcategoryId).filter(Boolean);
          userDefaults.subsubcategoryIds = (me.userSubsubCategories || []).map((i) => i.subsubCategoryId).filter(Boolean);
          userDefaults.identityIds = (me.identities || []).map(i => i.id).filter(Boolean);
          
          // Load interest interests (what the user is looking for)
          userDefaults.interestCategoryIds = (me.categoryInterests || []).map((i) => i.categoryId).filter(Boolean);
          userDefaults.interestSubcategoryIds = (me.subcategoryInterests || []).map((i) => i.subcategoryId).filter(Boolean);
          userDefaults.interestSubsubCategoryIds = (me.subsubInterests || []).map((i) => i.subsubCategoryId).filter(Boolean);
          userDefaults.interestIdentityIds = (me.identityInterests || []).map((i) => i.identityId).filter(Boolean);
          
          console.log('Current user interests loaded:', {
            categories: userDefaults.interestCategoryIds,
            subcategories: userDefaults.interestSubcategoryIds,
            subsubcategories: userDefaults.interestSubsubCategoryIds,
            identities: userDefaults.interestIdentityIds
          });
        }
      } catch (error) {
        console.error("Error loading current user data:", error);
      }
    }

    // Create myWant object here so it's accessible in calculateMatchPercentage
    const myWant = {
      xSet: new Set(userDefaults.interestSubsubCategoryIds?.map(String) || []),
      subSet: new Set(userDefaults.interestSubcategoryIds?.map(String) || []),
      catSet: new Set(userDefaults.interestCategoryIds?.map(String) || []),
      idSet: new Set(userDefaults.interestIdentityIds?.map(String) || []),
      city: (userDefaults.city || "").toLowerCase(),
      country: userDefaults.country,
    };

    const qCats = normalizeToArray(cats) || normalizeToArray(categoryId);
    const qSubcats = normalizeToArray(subcategoryId);

    const eff = {
      country: qCountry ?? userDefaults.country ?? null,
      city: qCity ?? userDefaults.city ?? null,
      categoryIds: qCats ? qCats : userDefaults.categoryIds.length ? userDefaults.categoryIds : null,
      subcategoryIds: qSubcats ? qSubcats : userDefaults.subcategoryIds.length ? userDefaults.subcategoryIds : null,
    };

    const baseUserGuards = {
      accountType: { [Op.ne]: "admin" },
      ...(currentUserId ? { id: { [Op.ne]: currentUserId } } : {}),
    };

    const whereUserBase = { ...baseUserGuards };
    if (eff.country) whereUserBase.country = eff.country;
    if (eff.city) whereUserBase.city = like(eff.city);
    if (q) {
      whereUserBase[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
      ];
    }

    const interestsWhere = {};
    if (eff.categoryIds) interestsWhere.categoryId = { [Op.in]: eff.categoryIds };
    if (eff.subcategoryIds) interestsWhere.subcategoryId = { [Op.in]: eff.subcategoryIds };

    const makeInterestsInclude = (required) => ([
      {
        model: UserCategory,
        as: "interests",
        required,
        where: Object.keys(interestsWhere).length ? interestsWhere : undefined,
        include: [
          { model: Category, as: "category", attributes: ["id", "name"], required: false },
          { model: Subcategory, as: "subcategory", attributes: ["id", "name"], required: false },
        ],
      },
      {
        model: UserSubcategory,
        as: "userSubcategories",
        attributes: ["subcategoryId"],
        required: false,
        include: [
          { model: Subcategory, as: "subcategory", attributes: ["id", "name"], required: false }
        ]
      },
      {
        model: UserSubsubCategory,
        as: "userSubsubCategories",
        attributes: ["subsubCategoryId"],
        required: false,
        include: [
          { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"], required: false }
        ]
      },
      {
        model: UserIdentityInterest,
        as: "identityInterests",
        attributes: ["identityId"],
        required: false,
        include: [
          { model: Identity, as: "identity", attributes: ["id", "name"], required: false }
        ]
      },
      {
        model: UserCategoryInterest,
        as: "categoryInterests", 
        attributes: ["categoryId"],
        required: false,
        include: [
          { model: Category, as: "category", attributes: ["id", "name"], required: false }
        ]
      },
      {
        model: UserSubcategoryInterest,
        as: "subcategoryInterests",
        attributes: ["subcategoryId"],
        required: false,
        include: [
          { model: Subcategory, as: "subcategory", attributes: ["id", "name"], required: false }
        ]
      },
      {
        model: UserSubsubCategoryInterest,
        as: "subsubInterests",
        attributes: ["subsubCategoryId"],
        required: false,
        include: [
          { model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"], required: false }
        ]
      },
      {
        model: Identity,
        as: "identities",
        attributes: ["id", "name"],
        required: false,
        through: { attributes: [] }
      }
    ]);

    const profileInclude = {
      model: Profile,
      as: "profile",
      attributes: ["professionalTitle", "about", "avatarUrl"],
      required: false,
    };

    const hasExplicitFilter = Boolean(q || qCountry || qCity || qCats || qSubcats);

    // INCREASE THE INITIAL FETCH LIMIT TO ENSURE ALL ASSOCIATIONS ARE LOADED
    const bufferLimit = Math.max(Number(limit) * 3, 50); // Fetch at least 50 users initially

    let matchesRaw = [];

      if (hasExplicitFilter) {
      matchesRaw = await User.findAll({
        subQuery: false,
        where: whereUserBase,
        include: [profileInclude, ...makeInterestsInclude(Boolean(qCats || qSubcats))],
        limit: bufferLimit, // Use buffer limit instead of actual limit
        order: [["createdAt", "DESC"]],
      });
    } else if (currentUserId) {
      if (userDefaults.categoryIds.length || userDefaults.subcategoryIds.length) {
       console.log('-1')
        matchesRaw = await User.findAll({
          subQuery: false,
          where: whereUserBase,
          include: [profileInclude, ...makeInterestsInclude(true)],
          limit: bufferLimit, // Use buffer limit instead of actual limit
          order: [["createdAt", "DESC"]],
        });
        console.log('1',matchesRaw.length)
      }
      if (!matchesRaw || matchesRaw.length === 0) {
         console.log('-2')
        matchesRaw = await User.findAll({
          subQuery: false,
          where: whereUserBase,
          include: [profileInclude, ...makeInterestsInclude(false)],
          limit: bufferLimit, // Use buffer limit instead of actual limit
          order: [["createdAt", "DESC"]],
        });
        console.log('2',matchesRaw.length)
      }
    } else {
      matchesRaw = await User.findAll({
        subQuery: false,
        where: whereUserBase,
        include: [profileInclude, ...makeInterestsInclude(false)],
        limit: bufferLimit, // Use buffer limit instead of actual limit
        order: [["createdAt", "DESC"]],
      });
    }

    const nearbyWhere = { ...baseUserGuards };
    if (eff.city) nearbyWhere.city = like(eff.city);
    else if (eff.country) nearbyWhere.country = eff.country;
    if (q) {
      nearbyWhere[Op.or] = [
        { name: like(q) },
        { email: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
      ];
    }

    const nearbyRaw = await User.findAll({
      subQuery: false,
      where: nearbyWhere,
      include: [profileInclude, ...makeInterestsInclude(Boolean(qCats || qSubcats))],
      limit: bufferLimit, // Use buffer limit instead of actual limit
      order: [["createdAt", "DESC"]],
    });

    // Helper functions for bidirectional matching
    function calculateBidirectionalMatch(aToB, bToA) {
      const average = (aToB + bToA) / 2;
      return average;
    }

    function calculateReciprocalWeightedMatch(aToB, bToA, weightSelf = 0.7) {
      const weightOther = 1 - weightSelf;
      const userAPerceived = (aToB * weightSelf) + (bToA * weightOther);
      return userAPerceived;
    }

    const calculateMatchPercentage = (u, useBidirectionalMatch = true) => {

      console.log('=== SUGGESTIONS MATCH DEBUG ===');
      console.log('Other user:', u.name, u.id);
      
      // Get what the other user OFFERS (does)
      const itemOfferings = {
        categories: (u.interests || []).map((i) => i.categoryId).filter(id => id != null).map(String),
        subcategories: (u.userSubcategories || []).map((i) => i.subcategoryId).filter(id => id != null).map(String),
        subsubcategories: (u.userSubsubCategories || []).map((i) => i.subsubCategoryId).filter(id => id != null).map(String),
        identities: (u.identities || []).map((i) => i.id).filter(id => id != null).map(String),
      };
      
      console.log('Other user offerings (what they do):', itemOfferings);
      
      // Get what the current user WANTS (looking for)
      const userInterests = {
        categories: Array.from(myWant.catSet).map(String),
        subcategories: Array.from(myWant.subSet).map(String),
        subsubcategories: Array.from(myWant.xSet).map(String),
        identities: Array.from(myWant.idSet).map(String),
      };
      
      console.log('Current user interests (what they want):', userInterests);
      
      const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
      let totalScore = 0;
      let totalPossibleScore = 0;
      
      // Identity matching - one match gives 100%
      if (userInterests.identities.length > 0) {
        const hasMatch = itemOfferings.identities.length > 0 && itemOfferings.identities.some(id => userInterests.identities.includes(id));
        console.log('Identity match:', hasMatch);
        if (hasMatch) {
          totalScore += WEIGHTS.identity;
        }
        totalPossibleScore += WEIGHTS.identity;
      }
      
      // Category matching - PROPORTIONAL based on matches
      if (userInterests.categories.length > 0) {
        const targetMatches = itemOfferings.categories.filter(id => userInterests.categories.includes(id));
        const pct = targetMatches.length / userInterests.categories.length;
        console.log(`Category matches: ${targetMatches.length}/${userInterests.categories.length} = ${Math.round(pct * 100)}%`);
        totalScore += WEIGHTS.category * pct;
        totalPossibleScore += WEIGHTS.category;
      }
      
      // Subcategory matching - PROPORTIONAL based on matches
      if (userInterests.subcategories.length > 0) {
        const targetMatches = itemOfferings.subcategories.filter(id => userInterests.subcategories.includes(id));
        const pct = targetMatches.length / userInterests.subcategories.length;
        console.log(`Subcategory matches: ${targetMatches.length}/${userInterests.subcategories.length} = ${Math.round(pct * 100)}%`);
        totalScore += WEIGHTS.subcategory * pct;
        totalPossibleScore += WEIGHTS.subcategory;
      }
      
      // Subsubcategory matching - PROPORTIONAL based on matches
      if (userInterests.subsubcategories.length > 0) {
        const targetMatches = itemOfferings.subsubcategories.filter(id => userInterests.subsubcategories.includes(id));
        const pct = targetMatches.length / userInterests.subsubcategories.length;
        console.log(`Subsubcategory matches: ${targetMatches.length}/${userInterests.subsubcategories.length} = ${Math.round(pct * 100)}%`);
        totalScore += WEIGHTS.subsubcategory * pct;
        totalPossibleScore += WEIGHTS.subsubcategory;
      }
      
      // Location matching
      const otherCity = (u.city || "").toLowerCase();
      let locationScore = 0;
      if (myWant.city && otherCity && otherCity === myWant.city) {
        locationScore = 10 * 0.6;
        totalScore += locationScore;
        totalPossibleScore += 10;
        console.log('Location match: exact city');
      } else if (myWant.country && u.country === myWant.country) {
        locationScore = 10 * 0.4;
        totalScore += locationScore;
        totalPossibleScore += 10;
        console.log('Location match: country');
      } else {
        console.log('Location match: none');
      }
      
      if (totalPossibleScore === 0) {
        console.log('No possible score, returning 0');
        return 0;
      }
      
      const unidirectionalPercentage = Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100)));
      console.log('Unidirectional percentage:', unidirectionalPercentage);
      
      // If bidirectional matching is disabled, return unidirectional percentage
      if (!useBidirectionalMatch) {
        return unidirectionalPercentage;
      }

      // BIDIRECTIONAL MATCHING CALCULATION
      console.log('=== BIDIRECTIONAL MATCH CALCULATION ===');
      
      // Calculate reverse percentage - what target user would get if searching for current user
      const reverseMatches = {
        identity: 0,
        category: 0,
        subcategory: 0,
        subsubcategory: 0
      };

      // Get target user's "looking for" (interests) - what they want from others
      const targetUserIdentityInterests = new Set((u.identityInterests || []).map(i => String(i.identityId)));
      const targetUserCategoryInterests = new Set((u.categoryInterests || []).map(i => String(i.categoryId)));
      const targetUserSubcategoryInterests = new Set((u.subcategoryInterests || []).map(i => String(i.subcategoryId)));
      const targetUserSubsubCategoryInterests = new Set((u.subsubInterests || []).map(i => String(i.subsubCategoryId)));

      // Get current user's "does" (what they offer) - what they can provide
      const currentUserIdentities = new Set(userDefaults.identityIds.map(String));
      const currentUserCategories = new Set(userDefaults.categoryIds.map(String));
      const currentUserSubcategories = new Set(userDefaults.subcategoryIds.map(String));
      const currentUserSubsubcategories = new Set(userDefaults.subsubcategoryIds.map(String));

      console.log('Target user interests (what they want):', {
        identity: [...targetUserIdentityInterests],
        category: [...targetUserCategoryInterests],
        subcategory: [...targetUserSubcategoryInterests],
        subsubcategory: [...targetUserSubsubCategoryInterests]
      });
      console.log('Current user does (what they offer):', {
        identity: [...currentUserIdentities],
        category: [...currentUserCategories],
        subcategory: [...currentUserSubcategories],
        subsubcategory: [...currentUserSubsubcategories]
      });

      // Direction 2: Target user wants -> Current user does (REVERSE DIRECTION)
      // 1. Identity matching - 100% if at least one match found
      if (targetUserIdentityInterests.size > 0) {
        const currentUserMatches = new Set([...targetUserIdentityInterests].filter(x => currentUserIdentities.has(x)));
        reverseMatches.identity = currentUserMatches.size > 0 ? 1 : 0;
        console.log(`Reverse identity match: ${currentUserMatches.size}/${targetUserIdentityInterests.size} = ${Math.round(reverseMatches.identity * 100)}%`);
      }

      // 2. Category matching - PROPORTIONAL based on matches
      if (targetUserCategoryInterests.size > 0) {
        const currentUserMatches = new Set([...targetUserCategoryInterests].filter(x => currentUserCategories.has(x)));
        const pct = currentUserMatches.size / targetUserCategoryInterests.size;
        console.log(`Reverse category match: ${currentUserMatches.size}/${targetUserCategoryInterests.size} = ${Math.round(pct * 100)}%`);
        reverseMatches.category = pct;
      }

      // 3. Subcategory matching - PROPORTIONAL based on matches
      if (targetUserSubcategoryInterests.size > 0) {
        const currentUserMatches = new Set([...targetUserSubcategoryInterests].filter(x => currentUserSubcategories.has(x)));
        const pct = currentUserMatches.size / targetUserSubcategoryInterests.size;
        console.log(`Reverse subcategory match: ${currentUserMatches.size}/${targetUserSubcategoryInterests.size} = ${Math.round(pct * 100)}%`);
        reverseMatches.subcategory = pct;
      }

      // 4. Subsubcategory matching - PROPORTIONAL based on matches
      if (targetUserSubsubCategoryInterests.size > 0) {
        const currentUserMatches = new Set([...targetUserSubsubCategoryInterests].filter(x => currentUserSubsubcategories.has(x)));
        const pct = currentUserMatches.size / targetUserSubsubCategoryInterests.size;
        console.log(`Reverse subsubcategory match: ${currentUserMatches.size}/${targetUserSubsubCategoryInterests.size} = ${Math.round(pct * 100)}%`);
        reverseMatches.subsubcategory = pct;
      }

      // Calculate reverse percentage
      let reverseTotalScore = 0;
      let reverseTotalPossibleScore = 0;

      console.log('=== REVERSE FINAL CALCULATION DEBUG ===');
      console.log('Reverse matches:', reverseMatches);

      Object.keys(reverseMatches).forEach(level => {
        const targetUserHasInterest = (
          (level === 'identity' && targetUserIdentityInterests.size > 0) ||
          (level === 'category' && targetUserCategoryInterests.size > 0) ||
          (level === 'subcategory' && targetUserSubcategoryInterests.size > 0) ||
          (level === 'subsubcategory' && targetUserSubsubCategoryInterests.size > 0)
        );

        if (targetUserHasInterest) {
          reverseTotalScore += WEIGHTS[level] * reverseMatches[level];
          reverseTotalPossibleScore += WEIGHTS[level];
          console.log(`Reverse ${level}: ${Math.round(WEIGHTS[level] * reverseMatches[level])}/${WEIGHTS[level]} (${Math.round(reverseMatches[level] * 100)}%)`);
        }
      });

      console.log(`Reverse total score: ${Math.round(reverseTotalScore)}/${reverseTotalPossibleScore}`);

      let reversePercentage = 0;
      if (reverseTotalPossibleScore > 0) {
        reversePercentage = Math.max(0, Math.min(100, Math.round((reverseTotalScore / reverseTotalPossibleScore) * 100)));
      }
      
      console.log(`Reverse percentage: ${reversePercentage}%`);

      // Calculate final bidirectional percentage based on selected formula
      let bidirectionalPercentage;
      if (userBidirectionalMatchFormula === "simple") {
        bidirectionalPercentage = calculateBidirectionalMatch(unidirectionalPercentage, reversePercentage);
        console.log(`Bidirectional percentage (simple average of ${unidirectionalPercentage}% and ${reversePercentage}%): ${Math.round(bidirectionalPercentage)}%`);
      } else {
        bidirectionalPercentage = calculateReciprocalWeightedMatch(unidirectionalPercentage, reversePercentage);
        console.log(`Bidirectional percentage (reciprocal weighted of ${unidirectionalPercentage}% and ${reversePercentage}%): ${Math.round(bidirectionalPercentage)}%`);
      }

      console.log('=== END BIDIRECTIONAL MATCH CALCULATION ===');
      return Math.round(bidirectionalPercentage);
    };


    const mapUser = (u, idx) => {
      const professionalTitle = u.profile?.professionalTitle || null;
      let matchPercentage = 0;
      if (currentUserId) {
        matchPercentage = calculateMatchPercentage(u, userBidirectionalMatch === 'true' || userBidirectionalMatch === true);
      }
      const interests = u.interests || [];
      const cats = interests.map((it) => it.category?.name).filter(Boolean);
      const subcats = interests.map((it) => it.subcategory?.name).filter(Boolean);
      return {
        id: u.id,
        name: u.name,
        role: professionalTitle,
        tag: professionalTitle || cats[0] || "",
        avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
        city: u.city || null,
        country: u.country || null,
        email: u.email,
        cats: cats,
        subcats: subcats,
        matchPercentage,
        percentMatch: matchPercentage,
        mockIndex: 30 + idx,
      };
    };


    let matches =  matchesRaw.map(mapUser);
    let nearby = nearbyRaw.map(mapUser);

    const allTargets = [...matches, ...nearby].map((u) => u.id).filter(Boolean);
    const statusMap = await getConnectionStatusMap(currentUserId, allTargets, {
      Connection,
      ConnectionRequest,
    });

    const decorate = (arr) =>
      arr.map((u) => ({
        ...u,
        connectionStatus: statusMap[u.id] || (currentUserId ? "none" : "unauthenticated"),
      }));

    const hasExplicitFilters = Boolean(qCountry || qCity || qCats || qSubcats);

    matches = decorate(matches).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );
    nearby = decorate(nearby).filter(
      (i) => i.connectionStatus == "none" || i.connectionStatus == "unauthenticated"
    );

    if (!hasExplicitFilters) {
      matches = matches.filter((i) => i.matchPercentage > 0);
      nearby = nearby.filter((i) => i.matchPercentage > 0);
    }

    matches.sort((a, b) => b.matchPercentage - a.matchPercentage);
    nearby.sort((a, b) => b.matchPercentage - a.matchPercentage);

    // APPLY THE ACTUAL LIMIT AFTER CALCULATING ALL MATCH PERCENTAGES
    matches = matches.slice(0, Number(limit));
    nearby = nearby.slice(0, Number(limit));

    res.json({
      matchesCount: matches.length,
      nearbyCount: nearby.length,
      matches,
      nearby,
      matchingConfig: {
        bidirectionalMatch: userBidirectionalMatch,
        bidirectionalMatchFormula: userBidirectionalMatchFormula
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get suggestions" });
  }
};