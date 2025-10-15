// src/controllers/onboarding.controller.js
const {
  sequelize,
  Profile,
  Identity,
  Goal,
  Category,
  Subcategory,
  SubsubCategory,
  UserIdentity,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  UserGoal,
  // interests
  UserIdentityInterest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  // industries
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
  UserIndustryCategory,
  UserIndustrySubcategory,
  UserIndustrySubsubCategory,
  UserSettings,
} = require("../models");


function arr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return [...new Set(val.filter(Boolean))];
  return [val];
}

exports.saveOneShot = async (req, res) => {
  const userId = req.user?.id || req.user?.sub;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });


  const {
    // what the user DOES
    identityIds = [],
    categoryIds = [],
    subcategoryIds = [],
    subsubCategoryIds = [],
    goalIds = [],

    // what the user is LOOKING FOR
    interestIdentityIds = [],
    interestCategoryIds = [],
    interestSubcategoryIds = [],
    interestSubsubCategoryIds = [],

    // industry selections
    industryCategoryIds = [],
    industrySubcategoryIds = [],
    industrySubsubCategoryIds = [],
  } = req.body || {};

  console.log({industryCategoryIds,industrySubcategoryIds,industrySubsubCategoryIds})


  const t = await sequelize.transaction();
  try {
    // --- Validate existence (drop invalid IDs) ---
    const [validIdentityIds, validCategoryIds, validSubcatIds, validSubsubIds, validGoalIds] =
      await Promise.all([
        Identity.findAll({ where: { id: arr(identityIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        Category.findAll({ where: { id: arr(categoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        Subcategory.findAll({ where: { id: arr(subcategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        SubsubCategory.findAll({ where: { id: arr(subsubCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        Goal.findAll({ where: { id: arr(goalIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
      ]);

    const [validInterestIdentityIds, validInterestCategoryIds, validInterestSubcatIds, validInterestSubsubIds] =
      await Promise.all([
        Identity.findAll({ where: { id: arr(interestIdentityIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        Category.findAll({ where: { id: arr(interestCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        Subcategory.findAll({ where: { id: arr(interestSubcategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        SubsubCategory.findAll({ where: { id: arr(interestSubsubCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
      ]);

    const [validIndustryCategoryIds, validIndustrySubcatIds, validIndustrySubsubIds] =
      await Promise.all([
        IndustryCategory.findAll({ where: { id: arr(industryCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        IndustrySubcategory.findAll({ where: { id: arr(industrySubcategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
        IndustrySubsubCategory.findAll({ where: { id: arr(industrySubsubCategoryIds) }, attributes: ["id"] }).then(r => r.map(x => x.id)),
      ]);

    // --- CLEAR previous selections (SEQUENTIAL: avoid Promise.all with same tx) ---
    await UserIdentity.destroy({ where: { userId }, transaction: t });
    await UserCategory.destroy({ where: { userId }, transaction: t });
    await UserSubcategory.destroy({ where: { userId }, transaction: t });
    await UserSubsubCategory.destroy({ where: { userId }, transaction: t });
    await UserGoal.destroy({ where: { userId }, transaction: t });

    await UserIdentityInterest.destroy({ where: { userId }, transaction: t });
    await UserCategoryInterest.destroy({ where: { userId }, transaction: t });
    await UserSubcategoryInterest.destroy({ where: { userId }, transaction: t });
    await UserSubsubCategoryInterest.destroy({ where: { userId }, transaction: t });

    // Clear industry selections
    await UserIndustryCategory.destroy({ where: { userId }, transaction: t });
    await UserIndustrySubcategory.destroy({ where: { userId }, transaction: t });
    await UserIndustrySubsubCategory.destroy({ where: { userId }, transaction: t });

    // --- CREATE new selections (bulkCreate per table) ---
    if (validIdentityIds.length) {
      await UserIdentity.bulkCreate(
        validIdentityIds.map(identityId => ({ userId, identityId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }
    if (validCategoryIds.length) {
      await UserCategory.bulkCreate(
        validCategoryIds.map(categoryId => ({ userId, categoryId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }
    if (validSubcatIds.length) {
      await UserSubcategory.bulkCreate(
        validSubcatIds.map(subcategoryId => ({ userId, subcategoryId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }
    if (validSubsubIds.length) {
      await UserSubsubCategory.bulkCreate(
        validSubsubIds.map(subsubCategoryId => ({ userId, subsubCategoryId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }
    if (validGoalIds.length) {
      await UserGoal.bulkCreate(
        validGoalIds.map(goalId => ({ userId, goalId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }

    // interests
    if (validInterestIdentityIds.length) {
      await UserIdentityInterest.bulkCreate(
        validInterestIdentityIds.map(identityId => ({ userId, identityId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }
    if (validInterestCategoryIds.length) {
      await UserCategoryInterest.bulkCreate(
        validInterestCategoryIds.map(categoryId => ({ userId, categoryId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }
    if (validInterestSubcatIds.length) {
      await UserSubcategoryInterest.bulkCreate(
        validInterestSubcatIds.map(subcategoryId => ({ userId, subcategoryId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }
    if (validInterestSubsubIds.length) {
      await UserSubsubCategoryInterest.bulkCreate(
        validInterestSubsubIds.map(subsubCategoryId => ({ userId, subsubCategoryId })),
        { transaction: t /*, ignoreDuplicates: true*/ }
      );
    }

    console.log({validIndustryCategoryIds})
    console.log({validIndustrySubcatIds})

    // Save industry selections using bulkCreate for consistency
    if (validIndustryCategoryIds.length) {
      await UserIndustryCategory.bulkCreate(
        validIndustryCategoryIds.map(industryCategoryId => ({ userId, industryCategoryId })),
        { transaction: t, ignoreDuplicates: true }
      );
    }
    if (validIndustrySubcatIds.length) {
      await UserIndustrySubcategory.bulkCreate(
        validIndustrySubcatIds.map(industrySubcategoryId => ({ userId, industrySubcategoryId })),
        { transaction: t, ignoreDuplicates: true }
      );
    }
    if (validIndustrySubsubIds.length) {
      await UserIndustrySubsubCategory.bulkCreate(
        validIndustrySubsubIds.map(industrySubsubCategoryId => ({ userId, industrySubsubCategoryId })),
        { transaction: t, ignoreDuplicates: true }
      );
    }

    // --- Profile flags (optional if fields exist) ---
    const prof = await Profile.findOne({ where: { userId }, transaction: t });
    if (prof) {
      prof.onboardingDone = true;
      prof.onboardingProfileTypeDone = true;
      prof.onboardingCategoriesDone  = true;
      prof.onboardingGoalsDone       = true;
      if ("onboardingLookingIdentitiesDone" in prof) prof.onboardingLookingIdentitiesDone = true;
      if ("onboardingLookingCategoriesDone"  in prof) prof.onboardingLookingCategoriesDone  = true;
      await prof.save({ transaction: t });
    }

    await t.commit();


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
            emailFrequency: "daily"
          }
     });


    return res.json({
      ok: true,
      saved: {
        identityIds: validIdentityIds,
        categoryIds: validCategoryIds,
        subcategoryIds: validSubcatIds,
        subsubCategoryIds: validSubsubIds,
        goalIds: validGoalIds,
        interestIdentityIds: validInterestIdentityIds,
        interestCategoryIds: validInterestCategoryIds,
        interestSubcategoryIds: validInterestSubcatIds,
        interestSubsubCategoryIds: validInterestSubsubIds,
        industryCategoryIds: validIndustryCategoryIds,
        industrySubcategoryIds: validIndustrySubcatIds,
        industrySubsubCategoryIds: validIndustrySubsubIds,
      },
      warnings: [],
    });
  } catch (e) {
    // only rollback if still active
    try { if (!t.finished) await t.rollback(); } catch {}
    console.error("saveOneShot error:", e);
    return res.status(500).json({
      message: "Failed to save onboarding data",
      // Uncomment in dev to see original SQL that failed:
      // sql: e?.sql,
      // original: e?.original?.sql,
    });
  }
};
