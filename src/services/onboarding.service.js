const {
  User,
  Profile,
  Identity,
  UserIdentity,
  Category,
  Subcategory,
  SubsubCategory,
  UserCategory,
  UserSubcategory,
  UserSubsubCategory,
  Goal,
  UserGoal,
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
  UserIndustryCategory,
  UserIndustrySubcategory,
  UserIndustrySubsubCategory,
} = require("../models");

function clampInt(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

async function getState(userId) {
  const [identCount, catCount, subCount, subsubCount, goalsCount, profile] = await Promise.all([
    UserIdentity.count({ where: { userId } }),
    UserCategory.count({ where: { userId } }),
    UserSubcategory.count({ where: { userId } }),
    UserSubsubCategory.count({ where: { userId } }),
    UserGoal.count({ where: { userId } }),
    Profile.findOne({ where: { userId } }),
  ]);

  // We no longer rely on profile.primaryIdentity to gate progress,
  // but we keep it if you want to show legacy UI. Progress uses new steps.
  const identitiesDone = identCount >= 1;
  const categoriesDone = catCount >= 1 && subCount >= 2; // level-3 optional for completion
  const goalsDone = goalsCount >= 1;

  let nextStep = null;
  if (!identitiesDone) nextStep = "identities";
  else if (!categoriesDone) nextStep = "industry";
  else if (!goalsDone) nextStep = "goals";

  const doneCount = (identitiesDone ? 1 : 0) + (categoriesDone ? 1 : 0) + (goalsDone ? 1 : 0);
  const progress = Math.round((doneCount / 3) * 100);

  return {
    identitiesDone,
    categoriesDone,
    goalsDone,
    nextStep,
    progress,
    legacyPrimaryIdentity: profile?.primaryIdentity ?? null,
  };
}

async function setIdentities(userId, identityIds = []) {
  const ids = Array.isArray(identityIds) ? identityIds.filter(Boolean) : [];
  if (ids.length < 1) {
    const err = new Error("Select at least 1 identity");
    err.status = 400;
    throw err;
  }

  const found = await Identity.findAll({ where: { id: ids } });
  if (found.length !== ids.length) {
    const err = new Error("Some identities are invalid");
    err.status = 400;
    throw err;
  }

  await UserIdentity.destroy({ where: { userId } });
  await Promise.all(ids.map((identityId) => UserIdentity.create({ userId, identityId })));

  // Optional: clear legacy single choice to avoid confusion
  const profile = await Profile.findOne({ where: { userId } });
  if (profile) {
    profile.primaryIdentity = null;
    await profile.save();
  }

  return getState(userId);
}

async function setCategories(userId, categoryIds = [], subcategoryIds = [], subsubCategoryIds = []) {
  const catIds = Array.isArray(categoryIds) ? categoryIds.filter(Boolean) : [];
  const subIds = Array.isArray(subcategoryIds) ? subcategoryIds.filter(Boolean) : [];
  const subsubIds = Array.isArray(subsubCategoryIds) ? subsubCategoryIds.filter(Boolean) : [];

  if (catIds.length < 1) {
    const err = new Error("At least 1 category required");
    err.status = 400;
    throw err;
  }
  if (subIds.length < 1) {
    const err = new Error("Select at least 1 subcategory (recommend 2+)");
    err.status = 400;
    throw err;
  }

  const [cats, subs, subsubs] = await Promise.all([
    Category.findAll({ where: { id: catIds } }),
    Subcategory.findAll({ where: { id: subIds } }),
    subsubIds.length ? SubsubCategory.findAll({ where: { id: subsubIds } }) : [],
  ]);

  if (cats.length !== catIds.length) {
    const err = new Error("Some categories are invalid");
    err.status = 400;
    throw err;
  }
  if (subs.length !== subIds.length) {
    const err = new Error("Some subcategories are invalid");
    err.status = 400;
    throw err;
  }
  if (subsubIds.length && subsubs.length !== subsubIds.length) {
    const err = new Error("Some level-3 subcategories are invalid");
    err.status = 400;
    throw err;
  }

  // Replace selections (idempotent)
  await Promise.all([
    UserCategory.destroy({ where: { userId } }),
    UserSubcategory.destroy({ where: { userId } }),
    UserSubsubCategory.destroy({ where: { userId } }),
  ]);

  await Promise.all([
    ...catIds.map((categoryId) => UserCategory.create({ userId, categoryId })),
    ...subIds.map((subcategoryId) => UserSubcategory.create({ userId, subcategoryId })),
    ...subsubIds.map((subsubCategoryId) => UserSubsubCategory.create({ userId, subsubCategoryId })),
  ]);

  return getState(userId);
}

async function setGoals(userId, goalIds = []) {
  const ids = Array.isArray(goalIds) ? goalIds.filter(Boolean) : [];
  if (ids.length === 0) {
    const err = new Error("Choose at least 1 goal");
    err.status = 400;
    throw err;
  }
  const found = await Goal.findAll({ where: { id: ids } });
  if (found.length !== ids.length) {
    const err = new Error("Invalid goals");
    err.status = 400;
    throw err;
  }

  await UserGoal.destroy({ where: { userId } });
  await Promise.all(ids.map((goalId) => UserGoal.create({ userId, goalId })));

  return getState(userId);
}

async function setIndustries(userId, industryCategoryIds = [], industrySubcategoryIds = [], industrySubsubCategoryIds = []) {
  const industryCatIds = Array.isArray(industryCategoryIds) ? industryCategoryIds.filter(Boolean) : [];
  const industrySubIds = Array.isArray(industrySubcategoryIds) ? industrySubcategoryIds.filter(Boolean) : [];
  const industrySubsubIds = Array.isArray(industrySubsubCategoryIds) ? industrySubsubCategoryIds.filter(Boolean) : [];

  if (industryCatIds.length < 1) {
    const err = new Error("At least 1 industry category required");
    err.status = 400;
    throw err;
  }

  const [industryCats, industrySubs, industrySubsubs] = await Promise.all([
    IndustryCategory.findAll({ where: { id: industryCatIds } }),
    industrySubIds.length ? IndustrySubcategory.findAll({ where: { id: industrySubIds } }) : [],
    industrySubsubIds.length ? IndustrySubsubCategory.findAll({ where: { id: industrySubsubIds } }) : [],
  ]);

  if (industryCats.length !== industryCatIds.length) {
    const err = new Error("Some industry categories are invalid");
    err.status = 400;
    throw err;
  }
  if (industrySubIds.length && industrySubs.length !== industrySubIds.length) {
    const err = new Error("Some industry subcategories are invalid");
    err.status = 400;
    throw err;
  }
  if (industrySubsubIds.length && industrySubsubs.length !== industrySubsubIds.length) {
    const err = new Error("Some industry level-3 subcategories are invalid");
    err.status = 400;
    throw err;
  }

  // Replace selections (idempotent)
  await Promise.all([
    UserIndustryCategory.destroy({ where: { userId } }),
    UserIndustrySubcategory.destroy({ where: { userId } }),
    UserIndustrySubsubCategory.destroy({ where: { userId } }),
  ]);

  await Promise.all([
    ...industryCatIds.map((industryCategoryId) => UserIndustryCategory.create({ userId, industryCategoryId })),
    ...industrySubIds.map((industrySubcategoryId) => UserIndustrySubcategory.create({ userId, industrySubcategoryId })),
    ...industrySubsubIds.map((industrySubsubCategoryId) => UserIndustrySubsubCategory.create({ userId, industrySubsubCategoryId })),
  ]);

  return getState(userId);
}

module.exports = { getState, setIdentities, setCategories, setGoals, setIndustries };
