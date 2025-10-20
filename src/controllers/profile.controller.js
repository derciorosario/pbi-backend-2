// src/controllers/profile.controller.js
const {
  sequelize,
  User,
  Profile,
  UserSettings,
  WorkSample,
  Gallery,
  Identity,
  Category,
  Subcategory,
  SubsubCategory,
  // FAZ (seleções do usuário)
  UserIdentity,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  // PROCURA (interesses)
  UserIdentityInterest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  // INDUSTRIES
  IndustryCategory,
  UserIndustryCategory,
  UserIndustrySubcategory,
  UserIndustrySubsubCategory,
  CompanyRepresentative,
  // Applications and registrations
  Job,
  JobApplication,
  Event,
  EventRegistration,
  // Audience associations
  JobIdentity,
  JobCategory,
  JobSubcategory,
  JobSubsubCategory,
  EventIdentity,
  EventCategory,
  EventSubcategory,
  EventSubsubCategory,
} = require("../models");
const IndustrySubcategory = require("../models/IndustrySubcategory");
const IndustrySubsubCategory = require("../models/IndustrySubsubCategory");


const { cache } = require("../utils/redis");


const { computeProfileProgress } = require("../utils/profileProgress");

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

/* Utils */
function arr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return [...new Set(val.filter(Boolean))];
  return [val];
}

async function ensureProfile(userId) {
  let profile = await Profile.findOne({ where: { userId } });
  if (!profile) {
    profile = await Profile.create({
      userId,
      onboardingProfileTypeDone: false,
      onboardingCategoriesDone:  false,
      onboardingGoalsDone:       false,
      primaryIdentity: null, // mantemos o campo caso use como rótulo/legenda
      categoryId: null,
      subcategoryId: null,
      birthDate: null,
      professionalTitle: null,
      about: null,
      avatarUrl: null,
      experienceLevel: null,
      skills: [],
      languages: [],
    });
  }
  return profile;
}

/* GET /api/profile/me */
async function getMe(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const user = await User.findByPk(userId, {
      attributes: {
        exclude: ["passwordHash"]
      },
         include: [
        {
          model: CompanyRepresentative,
          as: "representativeOf",   // 👈 companies this user represents
          include: [
            {
              model: User,
              as: "company",        // 👈 must match CompanyRepresentative.belongsTo(User, { as: "company" })
              attributes: ["id", "name", "email", "accountType", "avatarUrl"],
            },
          ],
        },
        {
          model: CompanyRepresentative,
          as: "companyRepresentatives", // 👈 representatives of this user’s company
          include: [
            {
              model: User,
              as: "representative", // 👈 must match CompanyRepresentative.belongsTo(User, { as: "representative" })
              attributes: ["id", "name", "email", "accountType", "avatarUrl"],
            },
          ],
        },
      ],
    });

    if (!user) return res.status(401).json({ message: "User not found" });

    const profile = await ensureProfile(userId);

    const [
      doIdentRows, doCatRows, doSubRows, doXRows,
      wantIdentRows, wantCatRows, wantSubRows, wantXRows,
      industryCatRows, industrySubRows, industryXRows,
      userSettings,
    ] = await Promise.all([
      UserIdentity.findAll({ where: { userId }, attributes: ["identityId"] }),
      UserCategory.findAll({ where: { userId }, attributes: ["categoryId"] }),
      UserSubcategory.findAll({ where: { userId }, attributes: ["subcategoryId"] }),
      UserSubsubCategory.findAll({ where: { userId }, attributes: ["subsubCategoryId"] }),

      UserIdentityInterest.findAll({ where: { userId }, attributes: ["identityId"] }),
      UserCategoryInterest.findAll({ where: { userId }, attributes: ["categoryId"] }),
      UserSubcategoryInterest.findAll({ where: { userId }, attributes: ["subcategoryId"] }),
      UserSubsubCategoryInterest.findAll({ where: { userId }, attributes: ["subsubCategoryId"] }),

      UserIndustryCategory.findAll({ where: { userId }, attributes: ["industryCategoryId"] }),
      UserIndustrySubcategory.findAll({ where: { userId }, attributes: ["industrySubcategoryId"] }),
      UserIndustrySubsubCategory.findAll({ where: { userId }, attributes: ["industrySubsubCategoryId"] }),

      UserSettings.findOrCreate({
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
          hideMainFeed: false
        }
      }).then(([settings]) => settings),
    ]);

    const galleryItems = await Gallery.count({
      where: { profileId: profile.id }
    });

    const workSamples=await WorkSample.count({
      where: { profileId: profile.id }
    });

    const counts = {
      identities:doIdentRows.length,
      categories:   doCatRows.length,
      subcategories: doSubRows.length,
      subsubs:       doXRows.length,

      workSamples,

      galleryItems,

      wantIdentities:wantIdentRows.length,
      wantCategories:   wantCatRows.length,
      wantSubcategories: wantSubRows.length,
      wantSubsubs:       wantXRows.length,
      
      industryCategories: industryCatRows.length,
      industrySubcategories:industrySubRows.length
    };

    const progress = computeProfileProgress({ user, profile, counts });

    return res.json({
      user,
      profile,
      settings: userSettings,
      counts,
      // FAZ
      doIdentityIds:        doIdentRows.map(r => r.identityId),
      doCategoryIds:        doCatRows.map(r => r.categoryId),
      doSubcategoryIds:     doSubRows.map(r => r.subcategoryId),
      doSubsubCategoryIds:  doXRows.map(r => r.subsubCategoryId),

      // PROCURA
      interestIdentityIds:       wantIdentRows.map(r => r.identityId),
      interestCategoryIds:       wantCatRows.map(r => r.categoryId),
      interestSubcategoryIds:    wantSubRows.map(r => r.subcategoryId),
      interestSubsubCategoryIds: wantXRows.map(r => r.subsubCategoryId),

      // INDUSTRIES
      industryCategoryIds:       industryCatRows.map(r => r.industryCategoryId),
      industrySubcategoryIds:    industrySubRows.map(r => r.industrySubcategoryId),
      industrySubsubCategoryIds: industryXRows.map(r => r.industrySubsubCategoryId),

      progress,
    });
  } catch (e) { next(e); }
}

/* PUT /api/profile/personal */
async function updatePersonal(req, res, next) {
  try {
    const userId = req.user.sub;
    const {
      name, phone, nationality, country, countryOfResidence, city,
      birthDate, professionalTitle, about, avatarUrl,gender,otherCountries,webpage, address
    } = req.body;


    const [user, profile] = await Promise.all([
      User.findByPk(userId),
      Profile.findOne({ where: { userId } }),
    ]);
    if (!user || !profile) return res.status(404).json({ message: "Profile not found" });

    if (name !== undefined) user.name = name;
    if (gender !== undefined) user.gender = gender;
    if (phone !== undefined) user.phone = phone;
    if (nationality !== undefined) user.nationality = nationality;
    if (country !== undefined) user.country = country;
    if (countryOfResidence !== undefined) user.countryOfResidence = countryOfResidence;
    if (city !== undefined) user.city = city;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl || null; // avatar principal do User
    user.otherCountries=otherCountries || []
    user.webpage=webpage || null
    user.address=address || null
    await user.save();

    if (birthDate !== undefined) profile.birthDate = birthDate || null;
    if (professionalTitle !== undefined) profile.professionalTitle = professionalTitle || null;
    if (about !== undefined) profile.about = about || null;
    await profile.save();

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

/* PUT /api/profile/professional
   ATENÇÃO: agora NÃO mexe mais em categorias/identidades.
   Apenas nível, skills e languages. */
async function updateProfessional(req, res, next) {
  try {
    const userId = req.user.sub;
    const { experienceLevel, skills = [], languages = [] } = req.body;

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    profile.experienceLevel = experienceLevel || null;
    profile.skills    = Array.isArray(skills) ? skills.slice(0, 50) : [];
    profile.languages = Array.isArray(languages) ? languages.slice(0, 20) : [];
    await profile.save();

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

/* Helpers de validação */
async function validateIds({ identityIds, categoryIds, subcategoryIds, subsubCategoryIds }) {
  const [
    vIdent,
    vCat,
    vSub,
    vX,
  ] = await Promise.all([
    Identity.findAll({ where: { id: arr(identityIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
    Category.findAll({ where: { id: arr(categoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
    Subcategory.findAll({ where: { id: arr(subcategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
    SubsubCategory.findAll({ where: { id: arr(subsubCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
  ]);
  return {
    identityIds: vIdent,
    categoryIds: vCat,
    subcategoryIds: vSub,
    subsubCategoryIds: vX,
  };
}

/* Helpers de validação para indústrias */
async function validateIndustryIds({ industryCategoryIds, industrySubcategoryIds, industrySubsubCategoryIds }) {
  const [
    vIndustryCat,
    vIndustrySub,
    vIndustryX,
  ] = await Promise.all([
    IndustryCategory.findAll({ where: { id: arr(industryCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
    // For subcategories and subsubs, we need to validate they exist in the industry tree
    // This is a simplified validation - in production you might want more complex validation
    Promise.resolve(arr(industrySubcategoryIds)),
    Promise.resolve(arr(industrySubsubCategoryIds)),
  ]);
  return {
    industryCategoryIds: vIndustryCat,
    industrySubcategoryIds: arr(industrySubcategoryIds),
    industrySubsubCategoryIds: arr(industrySubsubCategoryIds),
  };
}

/* PUT /api/profile/do-selections
   Atualiza o que o usuário FAZ (identidades/categorias/subs/subsubs) */
async function updateDoSelections(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.sub;
    const payload = await validateIds({
      identityIds:       req.body.identityIds,
      categoryIds:       req.body.categoryIds,
      subcategoryIds:    req.body.subcategoryIds,
      subsubCategoryIds: req.body.subsubCategoryIds,
    });

    // clear (sequencial na mesma transação)
    await UserIdentity.destroy({ where: { userId }, transaction: t });
    await UserCategory.destroy({ where: { userId }, transaction: t });
    await UserSubcategory.destroy({ where: { userId }, transaction: t });
    await UserSubsubCategory.destroy({ where: { userId }, transaction: t });

    // create
    if (payload.identityIds.length)
      await UserIdentity.bulkCreate(payload.identityIds.map(identityId => ({ userId, identityId })), { transaction: t });

    if (payload.categoryIds.length)
      await UserCategory.bulkCreate(payload.categoryIds.map(categoryId => ({ userId, categoryId })), { transaction: t });

    if (payload.subcategoryIds.length)
      await UserSubcategory.bulkCreate(payload.subcategoryIds.map(subcategoryId => ({ userId, subcategoryId })), { transaction: t });

    if (payload.subsubCategoryIds.length)
      await UserSubsubCategory.bulkCreate(payload.subsubCategoryIds.map(subsubCategoryId => ({ userId, subsubCategoryId })), { transaction: t });


    await cache.deleteKeys([
      ["feed",req.user.id] 
    ]);
     await cache.deleteKeys([
      ["people",req.user.id] 
    ]);

     await cache.deleteKeys([
      ["suggestions",req.user.id] 
    ]);

    

    await t.commit();
    return getMe(req, res, next);
  } catch (e) {
    try { if (!t.finished) await t.rollback(); } catch {}
    next(e);
  }
}

/* PUT /api/profile/interest-selections
   Atualiza o que o usuário PROCURA (interesses: identidades/categorias/subs/subsubs)
   Regras do produto: máx 3 identidades, máx 3 categorias.
   A API não precisa bloquear, mas vamos aplicar um clamp simples. */
async function updateInterestSelections(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.sub;

    // clamp simples (front já impõe limite, back reforça):
    const clamp3 = (xs) => arr(xs).slice(0, 3);

    const payload = await validateIds({
      identityIds:       clamp3(req.body.identityIds),
      categoryIds:       clamp3(req.body.categoryIds),
      subcategoryIds:    req.body.subcategoryIds,    // permitir N sob as categorias escolhidas
      subsubCategoryIds: req.body.subsubCategoryIds, // permitir N sob as categorias escolhidas
    });

    // clear (sequencial)
    await UserIdentityInterest.destroy({ where: { userId }, transaction: t });
    await UserCategoryInterest.destroy({ where: { userId }, transaction: t });
    await UserSubcategoryInterest.destroy({ where: { userId }, transaction: t });
    await UserSubsubCategoryInterest.destroy({ where: { userId }, transaction: t });

    // create
    if (payload.identityIds.length)
      await UserIdentityInterest.bulkCreate(payload.identityIds.map(identityId => ({ userId, identityId })), { transaction: t });

    if (payload.categoryIds.length)
      await UserCategoryInterest.bulkCreate(payload.categoryIds.map(categoryId => ({ userId, categoryId })), { transaction: t });

    if (payload.subcategoryIds.length)
      await UserSubcategoryInterest.bulkCreate(payload.subcategoryIds.map(subcategoryId => ({ userId, subcategoryId })), { transaction: t });

    if (payload.subsubCategoryIds.length)
      await UserSubsubCategoryInterest.bulkCreate(payload.subsubCategoryIds.map(subsubCategoryId => ({ userId, subsubCategoryId })), { transaction: t });


    await cache.deleteKeys([
      ["feed",req.user.id] 
    ]);
     await cache.deleteKeys([
      ["people",req.user.id] 
    ]);
     await cache.deleteKeys([
      ["suggestions",req.user.id] 
    ]);

    
    await t.commit();
    return getMe(req, res, next);
  } catch (e) {
    try { if (!t.finished) await t.rollback(); } catch {}
    next(e);
  }
}

/* PUT /api/profile/industry-selections
   Atualiza as seleções de indústrias do usuário */
async function updateIndustrySelections(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const userId = req.user.sub;
    const payload = await validateIndustryIds({
      industryCategoryIds: req.body.industryCategoryIds,
      industrySubcategoryIds: req.body.industrySubcategoryIds,
      industrySubsubCategoryIds: req.body.industrySubsubCategoryIds,
    });

    // clear (sequencial na mesma transação)
    await UserIndustryCategory.destroy({ where: { userId }, transaction: t });
    await UserIndustrySubcategory.destroy({ where: { userId }, transaction: t });
    await UserIndustrySubsubCategory.destroy({ where: { userId }, transaction: t });

    // create
    if (payload.industryCategoryIds.length)
      await UserIndustryCategory.bulkCreate(payload.industryCategoryIds.map(industryCategoryId => ({ userId, industryCategoryId })), { transaction: t });

    if (payload.industrySubcategoryIds.length)
      await UserIndustrySubcategory.bulkCreate(payload.industrySubcategoryIds.map(industrySubcategoryId => ({ userId, industrySubcategoryId })), { transaction: t });

    if (payload.industrySubsubCategoryIds.length)
      await UserIndustrySubsubCategory.bulkCreate(payload.industrySubsubCategoryIds.map(industrySubsubCategoryId => ({ userId, industrySubsubCategoryId })), { transaction: t });

    await t.commit();
    return getMe(req, res, next);
  } catch (e) {
    try { if (!t.finished) await t.rollback(); } catch {}
    next(e);
  }
}

/* PUT /api/profile/portfolio */
async function updatePortfolio(req, res, next) {
  try {
    const userId = req.user.sub;
    const { cvBase64 } = req.body;

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    // Validate cvBase64 is an array
    if (cvBase64 && !Array.isArray(cvBase64)) {
      return res.status(400).json({ message: "cvBase64 must be an array" });
    }

    // Validate each CV object has required fields
    if (cvBase64 && cvBase64.length > 0) {
      for (const cv of cvBase64) {
        if (!cv.original_filename || !cv.base64) {
          return res.status(400).json({ message: "Each CV must have original_filename and base64" });
        }
        // Add created_at if missing
        if (!cv.created_at) {
          cv.created_at = new Date().toISOString();
        }
      }
    }

    profile.cvBase64 = cvBase64 || [];
    await profile.save();

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

/* PUT /api/profile/availability */
async function updateAvailability(req, res, next) {
  try {
    const userId = req.user.sub;
    const { isOpenToWork } = req.body;

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });


    profile.isOpenToWork = isOpenToWork=== true || isOpenToWork==="true" ? true : false

    await profile.save();

    return getMe(req, res, next);
  } catch (e) { next(e); }
}

/* PUT /api/profile/avatar */
async function updateAvatarUrl(req, res, next) {
  try {
    const userId = req.user.sub;
    const  avatarUrl = req.savedFileUrl;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.avatarUrl = avatarUrl || null;
    await user.save();

    return res.json({ message: "Avatar updated successfully", avatarUrl: user.avatarUrl });
  } catch (e) { next(e); }
}


/* PUT /api/profile/avatar */
async function uploadLogo(req, res, next) {
  try {
    const  avatarUrl = req.savedFileUrl;
    return res.json({url:avatarUrl});
  } catch (e) { next(e); }
}


/* PUT /api/profile/avatar */
async function updateCoverImage(req, res, next) {
  try {
    const userId = req.user.sub;
    const  coverImage  = req.savedFileUrl;

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.coverImage = coverImage || null;
    await user.save();

    return res.json({ message: "Avatar updated successfully", coverImage: user.coverImage });
  } catch (e) { next(e); }
  
}

/* GET /api/profile/work-samples */
async function getWorkSamples(req, res, next) {
  try {
    const userId = req.user.sub;
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const workSamples = await WorkSample.findAll({
      where: { profileId: profile.id },
      order: [['createdAt', 'DESC']]
    });

    return res.json({ workSamples });
  } catch (e) { next(e); }
}

/* POST /api/profile/work-samples */
async function createWorkSample(req, res, next) {
  try {
    const userId = req.user.sub;
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const {
      title,
      description,
      projectUrl,
      imageBase64,
      imageFileName,
      category,
      technologies,
      attachments,
      completionDate,
      isPublic
    } = req.body;

    const workSample = await WorkSample.create({
      profileId: profile.id,
      title,
      description: description || null,
      projectUrl: projectUrl || null,
      imageBase64: imageBase64 || null,
      imageFileName: imageFileName || null,
      category: category || null,
      technologies: Array.isArray(technologies) ? technologies : [],
      attachments: Array.isArray(attachments) ? attachments : [],
      completionDate: completionDate || null,
      isPublic: isPublic !== undefined ? isPublic : true,
    });

    return res.json({ workSample });
  } catch (e) { next(e); }
}

/* PUT /api/profile/work-samples/:id */
async function updateWorkSample(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const workSample = await WorkSample.findOne({
      where: { id, profileId: profile.id }
    });
    if (!workSample) return res.status(404).json({ message: "Work sample not found" });

    const {
      title,
      description,
      projectUrl,
      imageBase64,
      imageFileName,
      category,
      technologies,
      attachments,
      completionDate,
      isPublic
    } = req.body;

    workSample.title = title || workSample.title;
    workSample.description = description !== undefined ? description : workSample.description;
    workSample.projectUrl = projectUrl !== undefined ? projectUrl : workSample.projectUrl;
    workSample.imageBase64 = imageBase64 !== undefined ? imageBase64 : workSample.imageBase64;
    workSample.imageFileName = imageFileName !== undefined ? imageFileName : workSample.imageFileName;
    workSample.category = category !== undefined ? category : workSample.category;
    workSample.technologies = Array.isArray(technologies) ? technologies : workSample.technologies;
    workSample.attachments = Array.isArray(attachments) ? attachments : workSample.attachments;
    workSample.completionDate = completionDate !== undefined ? completionDate : workSample.completionDate;
    workSample.isPublic = isPublic !== undefined ? isPublic : workSample.isPublic;

    await workSample.save();

    return res.json({ workSample });
  } catch (e) { next(e); }
}

/* DELETE /api/profile/work-samples/:id */
async function deleteWorkSample(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const workSample = await WorkSample.findOne({
      where: { id, profileId: profile.id }
    });
    if (!workSample) return res.status(404).json({ message: "Work sample not found" });

    await workSample.destroy();

    return res.json({ message: "Work sample deleted successfully" });
  } catch (e) { next(e); }
}

/* GET /api/profile/gallery */
async function getGallery(req, res, next) {
  try {
    const userId = req.user.sub;
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const gallery = await Gallery.findAll({
      where: { profileId: profile.id },
      order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
    });

    return res.json({ gallery });
  } catch (e) { next(e); }
}

/* GET /api/users/:userId/gallery - Get public gallery items for a specific user */
async function getUserGallery(req, res, next) {
  try {
    const { userId } = req.params;

    // Find the user's profile
    const profile = await Profile.findOne({
      where: { userId },
      include: [{
        model: Gallery,
        as: 'gallery',
        where: { isPublic: true },
        required: false,
        order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']]
      }]
    });

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    return res.json({
      gallery: profile.gallery || [],
      total: profile.gallery ? profile.gallery.length : 0
    });
  } catch (e) { next(e); }
}

/* POST /api/profile/gallery */
async function createGalleryItem(req, res, next) {
  try {
    console.log('Create gallery item request received');
    console.log('User:', req.user);
    console.log('Files:', req.files);
    console.log('Body:', req.body);

    const userId = req.user?.sub || req.user?.id;
    if (!userId) {
      console.log('No user ID found in request');
      return res.status(401).json({ message: "Authentication required" });
    }

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) {
      console.log('Profile not found for user:', userId);
      return res.status(404).json({ message: "Profile not found" });
    }

    const {
      title,
      description,
      isPublic,
      displayOrder
    } = req.body;

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      console.log('No files uploaded');
      return res.status(400).json({ message: "At least one image file is required" });
    }

    console.log(`Creating ${req.files.length} gallery items`);

    // Get the next display order if not provided
    const lastItem = await Gallery.findOne({
      where: { profileId: profile.id },
      order: [['displayOrder', 'DESC']]
    });

    const baseOrder = lastItem ? lastItem.displayOrder + 1 : 0;

    // Create gallery items for each uploaded file
    const createdItems = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];

      const galleryItem = await Gallery.create({
        profileId: profile.id,
        title: title || null,
        description: description || null,
        imageUrl: `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/api/uploads/${file.filename}`,
        imageFileName: file.originalname,
        isPublic: isPublic !== undefined ? isPublic : true,
        displayOrder: displayOrder !== undefined ? displayOrder + i : baseOrder + i,
      });

      createdItems.push(galleryItem);
      console.log(`Gallery item ${i + 1} created successfully:`, galleryItem.id);
    }

    return res.json({ galleryItems: createdItems });
  } catch (e) {
    console.error('Error creating gallery items:', e);
    next(e);
  }
}

/* PUT /api/profile/gallery/:id */
async function updateGalleryItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const galleryItem = await Gallery.findOne({
      where: { id, profileId: profile.id }
    });
    if (!galleryItem) return res.status(404).json({ message: "Gallery item not found" });

    const {
      title,
      description,
      isPublic,
      displayOrder
    } = req.body;

    if (title !== undefined) galleryItem.title = title;
    if (description !== undefined) galleryItem.description = description;

    // Update image if a new file was uploaded
    if (req.file) {
      galleryItem.imageUrl = req.savedFileUrl;
      galleryItem.imageFileName = req.file.originalname;
    }

    if (isPublic !== undefined) galleryItem.isPublic = isPublic;
    if (displayOrder !== undefined) galleryItem.displayOrder = displayOrder;

    await galleryItem.save();

    return res.json({ galleryItem });
  } catch (e) { next(e); }
}

/* DELETE /api/profile/gallery/:id */
async function deleteGalleryItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const galleryItem = await Gallery.findOne({
      where: { id, profileId: profile.id }
    });
    if (!galleryItem) return res.status(404).json({ message: "Gallery item not found" });

    await galleryItem.destroy();

    return res.json({ message: "Gallery item deleted successfully" });
  } catch (e) { next(e); }
}

/* PUT /api/profile/gallery/:id/reorder */
async function reorderGalleryItem(req, res, next) {
  try {
    const userId = req.user.sub;
    const { id } = req.params;
    const { newOrder } = req.body;

    if (newOrder === undefined || newOrder === null) {
      return res.status(400).json({ message: "New order is required" });
    }

    const profile = await Profile.findOne({ where: { userId } });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const galleryItem = await Gallery.findOne({
      where: { id, profileId: profile.id }
    });
    if (!galleryItem) return res.status(404).json({ message: "Gallery item not found" });

    const oldOrder = galleryItem.displayOrder;

    // Update the moved item
    galleryItem.displayOrder = newOrder;
    await galleryItem.save();

    // Shift other items to make room
    if (newOrder < oldOrder) {
      // Moving up: shift items between newOrder and oldOrder down
      await Gallery.increment('displayOrder', {
        by: 1,
        where: {
          profileId: profile.id,
          displayOrder: { [require('sequelize').Op.gte]: newOrder, [require('sequelize').Op.lt]: oldOrder }
        }
      });
    } else if (newOrder > oldOrder) {
      // Moving down: shift items between oldOrder and newOrder up
      await Gallery.increment('displayOrder', {
        by: -1,
        where: {
          profileId: profile.id,
          displayOrder: { [require('sequelize').Op.gt]: oldOrder, [require('sequelize').Op.lte]: newOrder }
        }
      });
    }

    return res.json({ message: "Gallery item reordered successfully" });
  } catch (e) { next(e); }
}

/**
 * Get job applications for company's jobs with similarity scores
 */
async function getJobApplicationsForCompany(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    // Get all job applications for jobs posted by this company
    const applications = await JobApplication.findAll({
      include: [
        {
          model: Job,
          as: "job",
          where: { postedByUserId: userId },
          include: [
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
        {
          model: User,
          as: "applicant",
          attributes: ["id", "name", "email", "avatarUrl", "phone"],
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["professionalTitle"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate similarity scores for each application
    const applicationsWithScores = await Promise.all(applications.map(async (app) => {
      // Get applicant's profile data
      const [
        doIdentRows, doCatRows, doSubRows, doXRows,
        industryCatRows, industrySubRows, industryXRows,
      ] = await Promise.all([
        UserIdentity.findAll({ where: { userId: app.applicant.id }, attributes: ["identityId"] }),
        UserCategory.findAll({ where: { userId: app.applicant.id }, attributes: ["categoryId"] }),
        UserSubcategory.findAll({ where: { userId: app.applicant.id }, attributes: ["subcategoryId"] }),
        UserSubsubCategory.findAll({ where: { userId: app.applicant.id }, attributes: ["subsubCategoryId"] }),
        UserIndustryCategory.findAll({ where: { userId: app.applicant.id }, attributes: ["industryCategoryId"] }),
        UserIndustrySubcategory.findAll({ where: { userId: app.applicant.id }, attributes: ["industrySubcategoryId"] }),
        UserIndustrySubsubCategory.findAll({ where: { userId: app.applicant.id }, attributes: ["industrySubsubCategoryId"] }),
      ]);

      const applicantProfile = {
        doIdentityIds: doIdentRows.map(r => r.identityId),
        doCategoryIds: doCatRows.map(r => r.categoryId),
        doSubcategoryIds: doSubRows.map(r => r.subcategoryId),
        doSubsubCategoryIds: doXRows.map(r => r.subsubCategoryId),
        industryCategoryIds: industryCatRows.map(r => r.industryCategoryId),
        industrySubcategoryIds: industrySubRows.map(r => r.industrySubcategoryId),
        industrySubsubCategoryIds: industryXRows.map(r => r.industrySubsubCategoryId),
      };

      const similarity = calculateSimilarityScore(applicantProfile, app.job, "job");
      return {
        ...app.toJSON(),
        similarityScore: similarity.percentage,
        similarity,
      };
    }));

    // Sort by similarity score descending
    applicationsWithScores.sort((a, b) => b.similarityScore - a.similarityScore);

    return res.json({
      applications: applicationsWithScores,
      total: applicationsWithScores.length,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Get event registrations for company's events with similarity scores
 */
async function getEventRegistrationsForCompany(req, res, next) {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    // Get all event registrations for events organized by this company
    const registrations = await EventRegistration.findAll({
      include: [
        {
          model: Event,
          as: "event",
          where: { organizerUserId: userId },
          include: [
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
        {
          model: User,
          as: "registrant",
          attributes: ["id", "name", "email", "avatarUrl", "phone"],
          include: [
            {
              model: Profile,
              as: "profile",
              attributes: ["professionalTitle"],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Calculate similarity scores for each registration
    const registrationsWithScores = await Promise.all(registrations.map(async (reg) => {
      // Get registrant's profile data
      const [
        doIdentRows, doCatRows, doSubRows, doXRows,
        industryCatRows, industrySubRows, industryXRows,
      ] = await Promise.all([
        UserIdentity.findAll({ where: { userId: reg.registrant.id }, attributes: ["identityId"] }),
        UserCategory.findAll({ where: { userId: reg.registrant.id }, attributes: ["categoryId"] }),
        UserSubcategory.findAll({ where: { userId: reg.registrant.id }, attributes: ["subcategoryId"] }),
        UserSubsubCategory.findAll({ where: { userId: reg.registrant.id }, attributes: ["subsubCategoryId"] }),
        UserIndustryCategory.findAll({ where: { userId: reg.registrant.id }, attributes: ["industryCategoryId"] }),
        UserIndustrySubcategory.findAll({ where: { userId: reg.registrant.id }, attributes: ["industrySubcategoryId"] }),
        UserIndustrySubsubCategory.findAll({ where: { userId: reg.registrant.id }, attributes: ["industrySubsubCategoryId"] }),
      ]);

      const registrantProfile = {
        doIdentityIds: doIdentRows.map(r => r.identityId),
        doCategoryIds: doCatRows.map(r => r.categoryId),
        doSubcategoryIds: doSubRows.map(r => r.subcategoryId),
        doSubsubCategoryIds: doXRows.map(r => r.subsubCategoryId),
        industryCategoryIds: industryCatRows.map(r => r.industryCategoryId),
        industrySubcategoryIds: industrySubRows.map(r => r.industrySubcategoryId),
        industrySubsubCategoryIds: industryXRows.map(r => r.industrySubsubCategoryId),
      };

      const similarity = calculateSimilarityScore(registrantProfile, reg.event, "event");
      return {
        ...reg.toJSON(),
        similarityScore: similarity.percentage,
        similarity,
      };
    }));

    // Sort by similarity score descending
    registrationsWithScores.sort((a, b) => b.similarityScore - a.similarityScore);

    return res.json({
      registrations: registrationsWithScores,
      total: registrationsWithScores.length,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  getMe,
  updatePersonal,
  updateProfessional,
  updatePortfolio,
  updateAvailability,
  updateAvatarUrl,
  getWorkSamples,
  createWorkSample,
  updateWorkSample,
  deleteWorkSample,
  getGallery,
  getUserGallery,
  createGalleryItem,
  updateGalleryItem,
  deleteGalleryItem,
  reorderGalleryItem,
  updateDoSelections,
  updateInterestSelections,
  updateIndustrySelections,
  getJobApplicationsForCompany,
  getEventRegistrationsForCompany,
  updateCoverImage,
  uploadLogo
};

