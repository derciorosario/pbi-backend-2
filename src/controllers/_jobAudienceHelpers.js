// controllers/_jobAudienceHelpers.js
const { Op } = require("sequelize");
const { Identity, Category, Subcategory, SubsubCategory } = require("../models");

function toIdArray(maybeArray) {
  if (maybeArray == null || maybeArray === "") return [];
  if (Array.isArray(maybeArray)) return [...new Set(maybeArray.map(String))];
  if (typeof maybeArray === "string") {
    return [...new Set(maybeArray.split(",").map(s => s.trim()).filter(Boolean))];
  }
  return [];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Ensure all entries are identity UUIDs.
 * If any string isn't a UUID, try to resolve it by Identity.name. */
async function normalizeIdentityIds(idsOrNames) {
  if (!idsOrNames?.length) return [];
  const ids = [];
  const names = [];
  for (const v of idsOrNames) {
    if (UUID_RE.test(v)) ids.push(v);
    else names.push(v);
  }
  if (names.length) {
    const found = await Identity.findAll({
      where: { name: { [Op.in]: names } },
      attributes: ["id", "name"],
      raw: true,
    });
    const byName = new Map(found.map(r => [r.name, r.id]));
    const missing = names.filter(n => !byName.has(n));
    if (missing.length) {
      throw new Error(`Unknown identities: ${missing.join(", ")}`);
    }
    ids.push(...names.map(n => byName.get(n)));
  }
  return [...new Set(ids)];
}

async function validateAudienceHierarchy({ categoryIds, subcategoryIds, subsubCategoryIds }) {
  try {
    // Convert to arrays if they're Sets - with safety checks
    const cats = Array.isArray(categoryIds) ? categoryIds : (categoryIds ? Array.from(categoryIds).slice(0, 1000) : []);
    const subs = Array.isArray(subcategoryIds) ? subcategoryIds : (subcategoryIds ? Array.from(subcategoryIds).slice(0, 1000) : []);
    const subsubs = Array.isArray(subsubCategoryIds) ? subsubCategoryIds : (subsubCategoryIds ? Array.from(subsubCategoryIds).slice(0, 1000) : []);

    console.log('Validating hierarchy:', { cats: cats.length, subs: subs.length, subsubs: subsubs.length });

    // Limit the number of items to prevent memory issues
    if (cats.length > 100 || subs.length > 500 || subsubs.length > 1000) {
      console.warn('Large number of audience items detected, limiting validation');
      return {
        categoryIds: cats.slice(0, 100),
        subcategoryIds: subs.slice(0, 500),
        subsubCategoryIds: subsubs.slice(0, 1000)
      };
    }

    // Build valid subcategory and subsubcategory sets based on selected categories
    let validSubs = new Set(subs.map(String));
    let validSubsubs = new Set(subsubs.map(String));

    if (subs.length && cats.length) {
      console.log('Validating subcategories against categories...');
      const subcats = await Subcategory.findAll({
        where: { id: { [Op.in]: subs.slice(0, 500) } }, // Limit query size
        attributes: ["id", "categoryId"],
        raw: true,
      });
      const allowed = new Set(cats.map(String));

      // Filter to only valid subcategories
      const validSubcats = subcats.filter(sc => allowed.has(String(sc.categoryId)));
      validSubs = new Set(validSubcats.map(sc => sc.id).map(String));

      console.log('Found subcategories:', subcats.length, 'Valid:', validSubcats.length);
    }

    if (subsubs.length && validSubs.size > 0) {
      console.log('Validating subsubcategories against subcategories...');
      const subsubcats = await SubsubCategory.findAll({
        where: { id: { [Op.in]: subsubs.slice(0, 1000) } }, // Limit query size
        attributes: ["id", "subcategoryId"],
        raw: true,
      });

      // Filter to only valid subsubcategories
      const validSubsubcats = subsubcats.filter(s => validSubs.has(String(s.subcategoryId)));
      validSubsubs = new Set(validSubsubcats.map(s => s.id).map(String));

      console.log('Found subsubcategories:', subsubcats.length, 'Valid:', validSubsubcats.length);
    }

    // Validate existence of valid items only - with limits
    if (cats.length) {
      const n = await Category.count({ where: { id: { [Op.in]: cats.slice(0, 100) } } });
      if (n !== cats.length && cats.length <= 100) throw new Error("Some categories do not exist.");
    }
    if (validSubs.size > 0) {
      const subsArray = Array.from(validSubs).slice(0, 500);
      const n = await Subcategory.count({ where: { id: { [Op.in]: subsArray } } });
      if (n !== subsArray.length) throw new Error("Some subcategories do not exist.");
    }
    if (validSubsubs.size > 0) {
      const subsubsArray = Array.from(validSubsubs).slice(0, 1000);
      const n = await SubsubCategory.count({ where: { id: { [Op.in]: subsubsArray } } });
      if (n !== subsubsArray.length) throw new Error("Some sub-subcategories do not exist.");
    }

    console.log('Hierarchy validation passed. Valid items:', {
      categories: cats.length,
      subcategories: validSubs.size,
      subsubcategories: validSubsubs.size
    });

    // Return the validated/filtered arrays
    return {
      categoryIds: cats,
      subcategoryIds: Array.from(validSubs),
      subsubCategoryIds: Array.from(validSubsubs)
    };
  } catch (error) {
    console.error('Error in validateAudienceHierarchy:', error);
    // Return safe defaults on error
    return {
      categoryIds: [],
      subcategoryIds: [],
      subsubCategoryIds: []
    };
  }
}

async function setJobAudience(job, { identityIds, categoryIds, subcategoryIds, subsubCategoryIds }) {
  console.log('Original audience data:', { identityIds, categoryIds, subcategoryIds, subsubCategoryIds });

  // Validate and fix hierarchy
  const validated = await validateAudienceHierarchy({ categoryIds, subcategoryIds, subsubCategoryIds });

  console.log('Validated audience data:', validated);

  // Properly clear existing associations and set new ones
  if (identityIds !== undefined) {
    await job.setAudienceIdentities([]); // Clear first
    if (identityIds && identityIds.length > 0) {
      await job.setAudienceIdentities(identityIds);
    }
  }

  if (categoryIds !== undefined) {
    await job.setAudienceCategories([]); // Clear first
    if (validated.categoryIds && validated.categoryIds.length > 0) {
      await job.setAudienceCategories(validated.categoryIds);
    }
  }

  if (subcategoryIds !== undefined) {
    await job.setAudienceSubcategories([]); // Clear first
    if (validated.subcategoryIds && validated.subcategoryIds.length > 0) {
      await job.setAudienceSubcategories(validated.subcategoryIds);
    }
  }

  if (subsubCategoryIds !== undefined) {
    await job.setAudienceSubsubs([]); // Clear first
    if (validated.subsubCategoryIds && validated.subsubCategoryIds.length > 0) {
      await job.setAudienceSubsubs(validated.subsubCategoryIds);
    }
  }
}

module.exports = {
  toIdArray,
  normalizeIdentityIds,    // <- NEW export
  validateAudienceHierarchy,
  setJobAudience,
};
