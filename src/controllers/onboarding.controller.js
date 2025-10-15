const Svc = require("../services/onboarding.service");

async function state(req, res, next) {
  try {
    const out = await Svc.getState(req.user.sub);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

async function saveIdentities(req, res, next) {
  try {
    let { primaryIdentity } = req.body;
    const out = await Svc.setIdentities(req.user.sub, primaryIdentity);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

async function saveCategories(req, res, next) {
  try {
    const { categoryIds, subcategoryIds, subsubCategoryIds } = req.body;
    const out = await Svc.setCategories(req.user.sub, categoryIds, subcategoryIds, subsubCategoryIds || []);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

async function saveGoals(req, res, next) {
  try {
    const { goalIds } = req.body;
    const out = await Svc.setGoals(req.user.sub, goalIds);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

async function saveIndustries(req, res, next) {
  try {
    const { industryCategoryIds, industrySubcategoryIds, industrySubsubCategoryIds } = req.body;
    const out = await Svc.setIndustries(req.user.sub, industryCategoryIds, industrySubcategoryIds || [], industrySubsubCategoryIds || []);
    res.json(out);
  } catch (e) {
    next(e);
  }
}


module.exports = { state, saveIdentities, saveCategories, saveGoals, saveIndustries };
