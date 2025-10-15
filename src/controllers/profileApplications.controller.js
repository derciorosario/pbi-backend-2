// src/controllers/profileApplications.controller.js
const {
  sequelize,
  User,
  Job,
  JobApplication,
  Event,
  EventRegistration,
  // User profile associations
  UserIdentity,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  UserIdentityInterest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIndustryCategory,
  UserIndustrySubcategory,
  UserIndustrySubsubCategory,
  // Job/Event audience associations
  JobIdentity,
  JobCategory,
  JobSubcategory,
  JobSubsubCategory,
  EventIdentity,
  EventCategory,
  EventSubcategory,
  EventSubsubCategory,
  // Industry models
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
} = require("../models");

/**
 * Calculate similarity score between user profile and job/event requirements
 * @param {Object} userProfile - User's profile data
 * @param {Object} entity - Job or Event object with audience associations
 * @param {string} entityType - 'job' or 'event'
 * @returns {Object} - Similarity score and matching details
 */
function calculateSimilarityScore(userProfile, entity, entityType) {
  let score = 0;
  let maxScore = 0;
  const matches = {
    identities: [],
    categories: [],
    subcategories: [],
    subsubcategories: [],
    industries: [],
  };

  // Helper function to check matches and include names
  const checkMatches = (userIds, entityItems, matchArray, weight = 1) => {
    const entityIds = entityItems?.map(item => item.id) || [];
    const entityMap = new Map(entityItems?.map(item => [item.id, item.name]) || []);

    const matchedIds = userIds.filter(id => entityIds.includes(id));
    if (matchedIds.length > 0) {
      score += matchedIds.length * weight;
      matchedIds.forEach(id => {
        matchArray.push({
          id,
          name: entityMap.get(id) || 'Unknown'
        });
      });
    }
    maxScore += Math.min(userIds.length, entityIds.length) * weight;
  };

  // Check identities
  checkMatches(userProfile.doIdentityIds || [], entity.audienceIdentities, matches.identities, 4);

  // Check categories
  checkMatches(userProfile.doCategoryIds || [], entity.audienceCategories, matches.categories, 3);

  // Check subcategories
  checkMatches(userProfile.doSubcategoryIds || [], entity.audienceSubcategories, matches.subcategories, 2);

  // Check subsubcategories
  checkMatches(userProfile.doSubsubCategoryIds || [], entity.audienceSubsubs, matches.subsubcategories, 1);

  // Check industries (for jobs only, events don't have industry fields)
  const industryMatches = [];
  if (entityType === 'job') {
    if (entity.industryCategoryId && (userProfile.industryCategoryIds || []).includes(entity.industryCategoryId)) {
      score += 2;
      industryMatches.push({
        id: entity.industryCategoryId,
        name: entity.industryCategory?.name || 'Unknown Industry Category',
        type: 'category'
      });
      maxScore += 2;
    }

    if (entity.industrySubcategoryId && (userProfile.industrySubcategoryIds || []).includes(entity.industrySubcategoryId)) {
      score += 1.5;
      industryMatches.push({
        id: entity.industrySubcategoryId,
        name: entity.industrySubcategory?.name || 'Unknown Industry Subcategory',
        type: 'subcategory'
      });
      maxScore += 1.5;
    }

    if (entity.industrySubsubCategoryId && (userProfile.industrySubsubCategoryIds || []).includes(entity.industrySubsubCategoryId)) {
      score += 1;
      industryMatches.push({
        id: entity.industrySubsubCategoryId,
        name: entity.industrySubsubCategory?.name || 'Unknown Industry Subsubcategory',
        type: 'subsubcategory'
      });
      maxScore += 1;
    }
  }

  matches.industries = industryMatches;

  // Calculate percentage
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
    score,
    maxScore,
    percentage,
    matches,
  };
}

/**
 * Get user's job applications with similarity scores
 */
async function getJobApplications(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    // Get user's profile data
    const [
      doIdentRows, doCatRows, doSubRows, doXRows,
      industryCatRows, industrySubRows, industryXRows,
    ] = await Promise.all([
      UserIdentity.findAll({ where: { userId }, attributes: ["identityId"] }),
      UserCategory.findAll({ where: { userId }, attributes: ["categoryId"] }),
      UserSubcategory.findAll({ where: { userId }, attributes: ["subcategoryId"] }),
      UserSubsubCategory.findAll({ where: { userId }, attributes: ["subsubCategoryId"] }),
      UserIndustryCategory.findAll({ where: { userId }, attributes: ["industryCategoryId"] }),
      UserIndustrySubcategory.findAll({ where: { userId }, attributes: ["industrySubcategoryId"] }),
      UserIndustrySubsubCategory.findAll({ where: { userId }, attributes: ["industrySubsubCategoryId"] }),
    ]);

    const userProfile = {
      doIdentityIds: doIdentRows.map(r => r.identityId),
      doCategoryIds: doCatRows.map(r => r.categoryId),
      doSubcategoryIds: doSubRows.map(r => r.subcategoryId),
      doSubsubCategoryIds: doXRows.map(r => r.subsubCategoryId),
      industryCategoryIds: industryCatRows.map(r => r.industryCategoryId),
      industrySubcategoryIds: industrySubRows.map(r => r.industrySubcategoryId),
      industrySubsubCategoryIds: industryXRows.map(r => r.industrySubsubCategoryId),
    };

    // Get user's job applications with job details and audience
    const applications = await JobApplication.findAll({
      where: { userId },
      include: [
        {
          model: User,
          as: "applicant",
          attributes: ["id", "name", "email", "avatarUrl"],
        },
        {
          model: Job,
          as: "job",
          attributes: ["id", "title", "description", "coverImageBase64", "industryCategoryId", "industrySubcategoryId", "industrySubsubCategoryId"],
          include: [
            {
              model: User,
              as: "postedBy",
              attributes: ["id", "name", "avatarUrl", "accountType"],
            },
            {
              association: "audienceIdentities",
              attributes: ["id", "name"],
              through: { attributes: [] },
            },
            {
              association: "audienceCategories",
              attributes: ["id", "name"],
              through: { attributes: [] },
            },
            {
              association: "audienceSubcategories",
              attributes: ["id", "name", "categoryId"],
              through: { attributes: [] },
            },
            {
              association: "audienceSubsubs",
              attributes: ["id", "name", "subcategoryId"],
              through: { attributes: [] },
            },
            {
              model: IndustryCategory,
              as: "industryCategory",
              attributes: ["id", "name"],
            },
            {
              model: IndustrySubcategory,
              as: "industrySubcategory",
              attributes: ["id", "name"],
            },
            {
              model: IndustrySubsubCategory,
              as: "industrySubsubCategory",
              attributes: ["id", "name"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate similarity scores and sort
    const applicationsWithScores = applications.map(app => {
      const similarity = calculateSimilarityScore(userProfile, app.job, "job");
      return {
        ...app.toJSON(),
        similarity,
      };
    });

    // Sort by similarity score descending
    applicationsWithScores.sort((a, b) => b.similarity.percentage - a.similarity.percentage);

    return res.json({
      applications: applicationsWithScores,
      total: applicationsWithScores.length,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Get user's event registrations with similarity scores
 */
async function getEventRegistrations(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    // Get user's profile data
    const [
      doIdentRows, doCatRows, doSubRows, doXRows,
      industryCatRows, industrySubRows, industryXRows,
    ] = await Promise.all([
      UserIdentity.findAll({ where: { userId }, attributes: ["identityId"] }),
      UserCategory.findAll({ where: { userId }, attributes: ["categoryId"] }),
      UserSubcategory.findAll({ where: { userId }, attributes: ["subcategoryId"] }),
      UserSubsubCategory.findAll({ where: { userId }, attributes: ["subsubCategoryId"] }),
      UserIndustryCategory.findAll({ where: { userId }, attributes: ["industryCategoryId"] }),
      UserIndustrySubcategory.findAll({ where: { userId }, attributes: ["industrySubcategoryId"] }),
      UserIndustrySubsubCategory.findAll({ where: { userId }, attributes: ["industrySubsubCategoryId"] }),
    ]);

    const userProfile = {
      doIdentityIds: doIdentRows.map(r => r.identityId),
      doCategoryIds: doCatRows.map(r => r.categoryId),
      doSubcategoryIds: doSubRows.map(r => r.subcategoryId),
      doSubsubCategoryIds: doXRows.map(r => r.subsubCategoryId),
      industryCategoryIds: industryCatRows.map(r => r.industryCategoryId),
      industrySubcategoryIds: industrySubRows.map(r => r.industrySubcategoryId),
      industrySubsubCategoryIds: industryXRows.map(r => r.industrySubsubCategoryId),
    };

    // Get user's event registrations with event details and audience
    const registrations = await EventRegistration.findAll({
      where: { userId },
      include: [
        {
          model: User,
          as: "registrant",
          attributes: ["id", "name", "email", "avatarUrl"],
        },
        {
          model: Event,
          as: "event",
          include: [
            {
              model: User,
              as: "organizer",
              attributes: ["id", "name", "avatarUrl", "accountType"],
            },
            {
              association: "audienceIdentities",
              attributes: ["id", "name"],
              through: { attributes: [] },
            },
            {
              association: "audienceCategories",
              attributes: ["id", "name"],
              through: { attributes: [] },
            },
            {
              association: "audienceSubcategories",
              attributes: ["id", "name", "categoryId"],
              through: { attributes: [] },
            },
            {
              association: "audienceSubsubs",
              attributes: ["id", "name", "subcategoryId"],
              through: { attributes: [] },
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate similarity scores and sort
    const registrationsWithScores = registrations.map(reg => {
      const similarity = calculateSimilarityScore(userProfile, reg.event, "event");
      return {
        ...reg.toJSON(),
        similarity,
      };
    });

    // Sort by similarity score descending
    registrationsWithScores.sort((a, b) => b.similarity.percentage - a.similarity.percentage);

    return res.json({
      registrations: registrationsWithScores,
      total: registrationsWithScores.length,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getJobApplications,
  getEventRegistrations,
};