const { Need, Category, Subcategory, SubsubCategory, GeneralCategory, GeneralSubcategory, IndustryCategory, IndustrySubcategory } = require("../models");
const { Op } = require("sequelize");
const { toIdArray, normalizeIdentityIds, validateAudienceHierarchy, setNeedAudience } = require("./_needAudienceHelpers");
const { cache } = require("../utils/redis");

const NEED_CACHE_TTL = 300;

function generateNeedCacheKey(needId) {
  return `need:${needId}`;
}

// Helper function to validate need data
function validateNeedData(body) {
  if (!body.title || !body.title.trim()) {
   // throw new Error("Title is required");
  }
  if (!body.description || !body.description.trim()) {
    throw new Error("Description is required");
  }
  if (body.urgency && !["Low", "Medium", "High", "Urgent"].includes(body.urgency)) {
   // throw new Error("Invalid urgency level");
  }
  if (body.relatedEntityType && !["job", "product", "service", "event","tourism", "partnership", "funding", "information", "other"].includes(body.relatedEntityType)) {
    throw new Error("Invalid related entity type");
  }
}

exports.uploadAttachments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }
    const filenames = req.files.map(file => file.filename);
    res.json({ filenames });
  } catch (error) {
    console.error('Error uploading attachments:', error);
    res.status(500).json({ message: 'Failed to upload attachments' });
  }
};





exports.create = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      description,
      budget,
      urgency = "Medium",
      location,
      criteria = [],
      attachments = [],
      country,
      city,

      // Audience selections
      identityIds: _identityIds,
      categoryIds: _categoryIds,
      subcategoryIds: _subcategoryIds,
      subsubCategoryIds: _subsubCategoryIds,

      // General taxonomy
      categoryId,
      subcategoryId,
      subsubCategoryId,

      // Industry taxonomy
      industryCategoryId,
      industrySubcategoryId,

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,

      // Related entity (optional)
      relatedEntityType,
      relatedEntityId,
    } = req.body;

    // Validate required fields
    validateNeedData({ title, description, urgency, relatedEntityType });

    // Normalize audience arrays
    const identityIds = await normalizeIdentityIds(toIdArray(_identityIds));
    const audienceCategoryIds = toIdArray(_categoryIds);
    const audienceSubcategoryIds = toIdArray(_subcategoryIds);
    const audienceSubsubCategoryIds = toIdArray(_subsubCategoryIds);

    // Validate audience hierarchy if any audience arrays were provided
    if (audienceCategoryIds.length || audienceSubcategoryIds.length || audienceSubsubCategoryIds.length) {
      try {
        await validateAudienceHierarchy({
          categoryIds: audienceCategoryIds,
          subcategoryIds: audienceSubcategoryIds,
          subsubCategoryIds: audienceSubsubCategoryIds
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // Validate category/subcategory relationships
    if (subcategoryId) {
      const sub = await Subcategory.findByPk(subcategoryId);
      if (!sub) return res.status(400).json({ message: "Invalid subcategory" });
      if (categoryId && String(sub.categoryId) !== String(categoryId)) {
        return res.status(400).json({ message: "Subcategory does not belong to selected category" });
      }
    }

    const need = await Need.create({
      userId: uid,
      title: title.trim(),
      description: description.trim(),
      budget: budget || null,
      urgency,
      location: location || null,
      country: country || null,
      city: city || null,
      criteria: Array.isArray(criteria) ? criteria : [],
      attachments: Array.isArray(attachments) ? attachments : [],

      // Taxonomy
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      subsubCategoryId: subsubCategoryId || null,
      industryCategoryId: industryCategoryId || null,
      industrySubcategoryId: industrySubcategoryId || null,

      // Related entity
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,

      publishedAt: new Date(),
    });

    // Set audience associations
    if (identityIds.length || audienceCategoryIds.length || audienceSubcategoryIds.length || audienceSubsubCategoryIds.length) {
      await setNeedAudience(need, {
        identityIds,
        categoryIds: audienceCategoryIds,
        subcategoryIds: audienceSubcategoryIds,
        subsubCategoryIds: audienceSubsubCategoryIds,
      });
    }

    const created = await Need.findByPk(need.id);

    res.status(201).json(created);
  } catch (err) {
    console.error("createNeed error:", err);
    res.status(400).json({ message: err.message || "Could not create need" });
  }
};

exports.update = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const need = await Need.findByPk(id);
    if (!need) return res.status(404).json({ message: "Need not found" });
    if (need.userId !== uid && req.user?.accountType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const {
      identityIds: _identityIds,
      categoryIds: _categoryIds,
      subcategoryIds: _subcategoryIds,
      subsubCategoryIds: _subsubCategoryIds,

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,

      ...body
    } = req.body;

    // Validate data
    validateNeedData(body);

    // Normalize audience arrays if provided
    const identityIds = _identityIds !== undefined ? await normalizeIdentityIds(toIdArray(_identityIds)) : null;
    const categoryIds = _categoryIds !== undefined ? toIdArray(_categoryIds) : null;
    const subcategoryIds = _subcategoryIds !== undefined ? toIdArray(_subcategoryIds) : null;
    const subsubCategoryIds = _subsubCategoryIds !== undefined ? toIdArray(_subsubCategoryIds) : null;

    // Validate hierarchy if any of the arrays was provided
    if (categoryIds || subcategoryIds || subsubCategoryIds) {
      try {
        await validateAudienceHierarchy({
          categoryIds: categoryIds ?? [need.categoryId].filter(Boolean),
          subcategoryIds: subcategoryIds ?? [need.subcategoryId].filter(Boolean),
          subsubCategoryIds: subsubCategoryIds ?? [],
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // Convert empty strings to null for foreign key fields
    if (body.categoryId === '') body.categoryId = null;
    if (body.subcategoryId === '') body.subcategoryId = null;
    if (body.subsubCategoryId === '') body.subsubCategoryId = null;
    if (body.industryCategoryId === '') body.industryCategoryId = null;
    if (body.industrySubcategoryId === '') body.industrySubcategoryId = null;

    // Update need
    Object.assign(need, {
      title: body.title?.trim() ?? need.title,
      description: body.description?.trim() ?? need.description,
      budget: body.budget ?? need.budget,
      urgency: body.urgency ?? need.urgency,
      location: body.location ?? need.location,
      city: body.city || null,
      country: body.country || null,
      criteria: body.criteria ?? need.criteria,
      attachments: body.attachments !== undefined
        ? (Array.isArray(body.attachments) ? body.attachments : [])
        : need.attachments,
      categoryId: body.categoryId ?? need.categoryId,
      subcategoryId: body.subcategoryId ?? need.subcategoryId,
      subsubCategoryId: body.subsubCategoryId ?? need.subsubCategoryId,
      industryCategoryId: body.industryCategoryId ?? need.industryCategoryId,
      industrySubcategoryId: body.industrySubcategoryId ?? need.industrySubcategoryId,
      relatedEntityType: body.relatedEntityType ?? need.relatedEntityType,
      relatedEntityId: body.relatedEntityId ?? need.relatedEntityId,

      generalCategoryId: generalCategoryId === '' ? null : generalCategoryId,
      generalSubcategoryId: generalSubcategoryId === '' ? null : generalSubcategoryId,
      generalSubsubCategoryId: generalSubsubCategoryId === '' ? null : generalSubsubCategoryId,
    });

    await need.save();

    // Update audience associations if provided
    if (identityIds !== null || categoryIds !== null || subcategoryIds !== null || subsubCategoryIds !== null) {
      await setNeedAudience(need, {
        identityIds: identityIds ?? undefined,
        categoryIds: categoryIds ?? undefined,
        subcategoryIds: subcategoryIds ?? undefined,
        subsubCategoryIds: subsubCategoryIds ?? undefined,
      });
    }

     await cache.deleteKeys([
              ["feed",req.user.id] 
     ]);
    
    await exports.getOne({ params: { id: need.id }, query: { updated: true } }, res);

  } catch (err) {
    console.error("updateNeed error:", err);
    res.status(400).json({ message: err.message || "Could not update need" });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.query.updated;

    // Need cache: try read first
    const __needCacheKey = generateNeedCacheKey(id);

    if(!updated){
      try {
          const cached = await cache.get(__needCacheKey);
          if (cached) {
            console.log(`✅ Need cache hit for key: ${__needCacheKey}`);
            return res.json(cached);
          }
        } catch (e) {
          console.error("Need cache read error:", e.message);
        }
    }
 
    const need = await Need.findByPk(id, {
      include: [
        { association: "user", attributes: ["id","name","email","accountType"] },
        { association: "industryCategory" },
        { association: "industrySubcategory" },
        { association: "industrySubsubCategory" },

        // Audience associations
        { association: "audienceIdentities", attributes: ["id","name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id","name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id","name","categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id","name","subcategoryId"], through: { attributes: [] } },
      ],
    });

    if (!need) return res.status(404).json({ message: "Need not found" });

    try {
      await cache.set(__needCacheKey, need, NEED_CACHE_TTL);
      console.log(`💾 Need cached: ${__needCacheKey}`);
    } catch (e) {
      console.error("Need cache write error:", e.message);
    }

    res.json(need);
  } catch (err) {
    console.error("getOne error", err);
    res.status(500).json({ message: "Failed to fetch need" });
  }
};

exports.list = async (req, res) => {
  const { q, categoryId, subcategoryId, userId, relatedEntityType, urgency } = req.query;
  const where = {};

  if (categoryId) where.categoryId = categoryId;
  if (subcategoryId) where.subcategoryId = subcategoryId;
  if (userId) where.userId = userId;
  if (relatedEntityType) where.relatedEntityType = relatedEntityType;
  if (urgency) where.urgency = urgency;

  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
    ];
  }

  const rows = await Need.findAll({
    where,
    order: [["publishedAt", "DESC"]],
  });
  res.json(rows);
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const need = await Need.findByPk(id);
    if (!need) return res.status(404).json({ message: "Need not found" });
    if (need.userId !== uid && req.user?.accountType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await need.destroy();
    res.json({ message: "Need deleted successfully" });
  } catch (err) {
    console.error("deleteNeed error:", err);
    res.status(400).json({ message: err.message || "Could not delete need" });
  }
};
