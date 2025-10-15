
const { Moment, Category, Subcategory, SubsubCategory } = require("../models");
const { toIdArray, validateAudienceHierarchy, setJobAudience } = require("./_jobAudienceHelpers");
const { cache } = require("../utils/redis");

const MOMENT_CACHE_TTL = 300;

function generateMomentCacheKey(momentId) {
  return `moment:${momentId}`;
}

// Handle image uploads for moments
exports.uploadImages = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const filenames = req.files.map(file => file.filename);
    res.json({ filenames });
  } catch (err) {
    console.error("uploadImages error", err);
    res.status(500).json({ message: err.message });
  }
};

exports.createMoment = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const {
      title, description, type, date, location, tags, images, attachments,
      relatedEntityType, relatedEntityId,
      country,
      city,
      


      // Classification (optional)
      industryCategoryId, industrySubcategoryId, industrySubsubCategoryId,

      // NEW (arrays are accepted as arrays or CSV):
      identityIds: _identityIds,
      categoryIds: _categoryIds,
      subcategoryIds: _subcategoryIds,
      subsubCategoryIds: _subsubCategoryIds,

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,
    } = req.body;

    // normalize tags
    const parsedTags = parseTags(tags);

    // NEW: normalize audience arrays
    const identityIds = toIdArray(_identityIds);
    const audienceCategoryIds = toIdArray(_categoryIds);
    const audienceSubcategoryIds = toIdArray(_subcategoryIds);
    const audienceSubsubCategoryIds = toIdArray(_subsubCategoryIds);

    // Validate audience hierarchy if any audience arrays were provided
    if (audienceCategoryIds.length || audienceSubcategoryIds.length || audienceSubsubCategoryIds.length) {
      await validateAudienceHierarchy({
        categoryIds: audienceCategoryIds,
        subcategoryIds: audienceSubcategoryIds,
        subsubCategoryIds: audienceSubsubCategoryIds
      });
    }

    // create moment
    const moment = await Moment.create({
      userId: req.user.id,
      title, description, type,
      date: date || null,
      location: location || null,
      tags: parsedTags,
      images: Array.isArray(images) ? images : [],
      attachments: Array.isArray(attachments) ? attachments : [],
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
      country,
      city,
      // Classification (optional)
      industryCategoryId: industryCategoryId || null,
      industrySubcategoryId: industrySubcategoryId || null,
      industrySubsubCategoryId: industrySubsubCategoryId || null,

      generalCategoryId:generalCategoryId || null,
      generalSubcategoryId:generalSubcategoryId || null,
      generalSubsubCategoryId:generalSubsubCategoryId || null,
    });

    // attach audience sets
    if (identityIds.length || audienceCategoryIds.length || audienceSubcategoryIds.length || audienceSubsubCategoryIds.length) {
      await setMomentAudience(moment, {
        identityIds,
        categoryIds: audienceCategoryIds,
        subcategoryIds: audienceSubcategoryIds,
        subsubCategoryIds: audienceSubsubCategoryIds,
      });
    }

    res.status(201).json({ moment });
  } catch (err) {
    console.error("createMoment error", err);
    res.status(400).json({ message: err.message });
  }
};

const parseTags = (t) => {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  return String(t).split(",").map(x => x.trim()).filter(Boolean);
};

async function setMomentAudience(moment, { identityIds, categoryIds, subcategoryIds, subsubCategoryIds }) {
  if (identityIds)        await moment.setAudienceIdentities(identityIds);
  if (categoryIds)        await moment.setAudienceCategories(categoryIds);
  if (subcategoryIds)     await moment.setAudienceSubcategories(subcategoryIds);
  if (subsubCategoryIds)  await moment.setAudienceSubsubs(subsubCategoryIds);
}

exports.updateMoment = async (req, res) => {
  try {
    const id = req.params.id;
    const moment = await Moment.findByPk(id);
    if (!moment) return res.status(404).json({ message: "Moment not found" });
    if (String(moment.userId) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = { ...req.body };

    // normalize tags
    if (data.tags !== undefined) data.tags = parseTags(data.tags);

    // handle images and attachments arrays
    if (data.images !== undefined) data.images = Array.isArray(data.images) ? data.images : [];
    if (data.attachments !== undefined) data.attachments = Array.isArray(data.attachments) ? data.attachments : [];

    // Convert empty strings to null for foreign key fields
    if (data.industryCategoryId === '') data.industryCategoryId = null;
    if (data.industrySubcategoryId === '') data.industrySubcategoryId = null;
    if (data.industrySubsubCategoryId === '') data.industrySubsubCategoryId = null;


    if (data.generalCategoryId === '') data.generalCategoryId = null;
    if (data.generalSubcategoryId === '') data.generalSubcategoryId = null;
    if (data.generalSubsubCategoryId === '') data.generalSubsubCategoryId = null;

    // NEW: optional audience arrays
    const identityIds        = data.identityIds        !== undefined ? toIdArray(data.identityIds)        : null;
    const categoryIds        = data.categoryIds        !== undefined ? toIdArray(data.categoryIds)        : null;
    const subcategoryIds     = data.subcategoryIds     !== undefined ? toIdArray(data.subcategoryIds)     : null;
    const subsubCategoryIds  = data.subsubCategoryIds  !== undefined ? toIdArray(data.subsubCategoryIds)  : null;

    // Validate hierarchy if any of the arrays was provided
    if (categoryIds || subcategoryIds || subsubCategoryIds) {
      await validateAudienceHierarchy({
        categoryIds: categoryIds ?? [],
        subcategoryIds: subcategoryIds ?? [],
        subsubCategoryIds: subsubCategoryIds ?? [],
      });
    }

    await moment.update(data);

    // Update audience sets (only those provided)
    await setMomentAudience(moment, {
      identityIds: identityIds ?? undefined,
      categoryIds: categoryIds ?? undefined,
      subcategoryIds: subcategoryIds ?? undefined,
      subsubCategoryIds: subsubCategoryIds ?? undefined,
    });

     await cache.deleteKeys([
          ["feed",req.user.id] 
     ]);

    await exports.getMoment({ params: { id: moment.id }, query: { updated: true } }, res);

  } catch (err) {
    console.error("updateMoment error", err);
    res.status(400).json({ message: err.message });
  }
};

exports.getMoment = async (req, res) => {
  try {
    const momentId = req.params.id;
     const updated = req.query.updated;

    // Moment cache: try read first
    const __momentCacheKey = generateMomentCacheKey(momentId);

    if(!updated){

        try {
      const cached = await cache.get(__momentCacheKey);
      if (cached) {
        console.log(`✅ Moment cache hit for key: ${__momentCacheKey}`);
        return res.json(cached);
      }
    } catch (e) {
      console.error("Moment cache read error:", e.message);
    }

    }
  
    const moment = await Moment.findByPk(momentId, {
      include: [
        { association: "user", attributes: ["id","name","email","accountType"] },
        { association: "industryCategory" },
        { association: "industrySubcategory" },
        { association: "industrySubsubCategory" },
        { association: "generalCategory" },
        { association: "generalSubcategory" },
        { association: "generalSubsubCategory" },

        // Audience associations
        { association: "audienceIdentities", attributes: ["id","name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id","name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id","name","categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id","name","subcategoryId"], through: { attributes: [] } },
      ],
    });
    if (!moment) return res.status(404).json({ message: "Moment not found" });

    try {
      await cache.set(__momentCacheKey, moment, MOMENT_CACHE_TTL);
      console.log(`💾 Moment cached: ${__momentCacheKey}`);
    } catch (e) {
      console.error("Moment cache write error:", e.message);
    }

    res.json(moment);
  } catch (err) {
    console.error("getMoment error", err);
    res.status(500).json({ message: "Failed to fetch moment" });
  }
};

exports.listMoments = async (req, res) => {
  const { categoryId, subcategoryId, userId, q } = req.query;
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (subcategoryId) where.subcategoryId = subcategoryId;
  if (userId) where.userId = userId;
  if (q) where.title = { [require("sequelize").Op.like]: `%${q}%` };

  const moments = await Moment.findAll({
    where,
    order: [["createdAt","DESC"]],
    include: [
      { association: "user", attributes: ["id","name","email","accountType"] },
      { association: "category" },
      { association: "subcategory" }
    ],
  });
  res.json({ moments });
};

exports.deleteMoment = async (req, res) => {
  try {
    const id = req.params.id;
    const moment = await Moment.findByPk(id);
    if (!moment) return res.status(404).json({ message: "Moment not found" });
    if (String(moment.userId) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await moment.destroy();
    res.json({ message: "Moment deleted successfully" });
  } catch (err) {
    console.error("deleteMoment error", err);
    res.status(400).json({ message: err.message });
  }
};