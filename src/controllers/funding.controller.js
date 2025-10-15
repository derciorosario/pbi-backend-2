const { Funding, Category, Subcategory, SubsubCategory, User } = require("../models");
const { Op } = require("sequelize");
const { toIdArray, normalizeIdentityIds, validateAudienceHierarchy, setFundingAudience } = require("./_fundingAudienceHelpers");
const { cache } = require("../utils/redis");

const FUNDING_CACHE_TTL = 300;

function generateFundingCacheKey(fundingId) {
  return `funding:${fundingId}`;
}

exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    order: [["name", "ASC"]],
    include: [{ model: Subcategory, as: "subcategories", order: [["name", "ASC"]] }],
  });

  const currencies = ["USD", "EUR", "GBP", "NGN", "GHS", "ZAR", "KES", "UGX", "TZS", "XOF", "XAF", "MAD", "DZD", "TND", "EGP", "ETB", "NAD", "BWP", "MZN", "ZMW", "RWF", "BIF", "SOS", "SDG", "CDF"];
  const statuses = ["draft", "published", "funded", "closed"];
  const visibilities = ["public", "private"];

  res.json({
    categories,
    currencies,
    statuses,
    visibilities
  });
};



exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const filenames = req.files.map(file => file.filename);

    res.json({ filenames });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ message: 'Failed to upload images' });
  }
};

exports.create = async (req, res) => {
  try {
    const uid = req.user?.id; // from auth middleware
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      categoryId,
      country,
      city,
      goal,
      currency,
      deadline,
      pitch,
      rewards,
      team,
      email,
      phone,
      links,
      tags,
      images,
      status,
      visibility,

      // Audience selection
      identityIds: _identityIds,
      categoryIds: _categoryIds,
      subcategoryIds: _subcategoryIds,
      subsubCategoryIds: _subsubCategoryIds,


      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,

      // Industry fields
      industryCategoryId,
      industrySubcategoryId,
    } = req.body;

    // Basic validation
    if (!title || !pitch) return res.status(400).json({ message: "Title and pitch are required" });
    if (!country) return res.status(400).json({ message: "Country is required" });
    if (!goal || isNaN(Number(goal)) || Number(goal) <= 0) {
      return res.status(400).json({ message: "Funding goal must be a positive number" });
    }
    if (!deadline) return res.status(400).json({ message: "Deadline is required" });
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    // Normalize audience arrays
    const identityIds = await normalizeIdentityIds(toIdArray(_identityIds));
    const categoryIds = toIdArray(_categoryIds);
    const subcategoryIds = toIdArray(_subcategoryIds);
    const subsubCategoryIds = toIdArray(_subsubCategoryIds);

    // Validate audience hierarchy
    if (categoryIds.length || subcategoryIds.length || subsubCategoryIds.length) {
      try {
        await validateAudienceHierarchy({
          categoryIds,
          subcategoryIds,
          subsubCategoryIds
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // Create funding project
    const funding = await Funding.create({
      creatorUserId: uid,
      title,
      categoryId: categoryId || null,
      country,
      city: city || null,
      goal: Number(goal),
      raised: req.body.raised ? Number(req.body.raised) : 0,
      currency: currency || "USD",
      deadline,
      pitch,
      rewards: rewards || null,
      team: team || null,
      email: email || null,
      phone: phone || null,
      links: Array.isArray(links) ? links : [],
      tags: Array.isArray(tags) ? tags : [],
      images: Array.isArray(images) ? images.map(img => typeof img === 'string' ? img : img.filename).filter(Boolean) : [],
      status: status || "draft",
      visibility: visibility || "public",

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,
      industryCategoryId,
      industrySubcategoryId,
    });

    // Set audience associations
    await setFundingAudience(funding, {
      identityIds,
      categoryIds,
      subcategoryIds,
      subsubCategoryIds
    });

    const created = await Funding.findByPk(funding.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
        { model: Category, as: "category" },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });

    await cache.deleteKeys([
      ["feed", "funding", req.user.id] 
    ]);
     await cache.deleteKeys([
          ["feed","all",req.user.id] 
        ]);
    res.status(201).json(created);
  } catch (err) {
    console.error("createFunding error:", err);
    res.status(400).json({ message: err.message || "Could not create funding project" });
  }
};

exports.update = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const funding = await Funding.findByPk(id);
    if (!funding) return res.status(404).json({ message: "Funding project not found" });
    if (funding.creatorUserId !== uid && req.user?.accountType !== "admin") {
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

      // Industry fields
      industryCategoryId,
      industrySubcategoryId,
      ...body
    } = req.body;

    // Normalize audience arrays if provided
    const identityIds = _identityIds !== undefined ? await normalizeIdentityIds(toIdArray(_identityIds)) : null;
    const categoryIds = _categoryIds !== undefined ? toIdArray(_categoryIds) : null;
    const subcategoryIds = _subcategoryIds !== undefined ? toIdArray(_subcategoryIds) : null;
    const subsubCategoryIds = _subsubCategoryIds !== undefined ? toIdArray(_subsubCategoryIds) : null;

    // Validate hierarchy if any of the arrays was provided
    if (categoryIds || subcategoryIds || subsubCategoryIds) {
      try {
        await validateAudienceHierarchy({
          categoryIds: categoryIds ?? [],
          subcategoryIds: subcategoryIds ?? [],
          subsubCategoryIds: subsubCategoryIds ?? [],
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // Handle tags array
    let tags = funding.tags;
    if (body.tags !== undefined) {
      tags = Array.isArray(body.tags) ? body.tags : [];
    }

    // Handle links array
    let links = funding.links;
    if (body.links !== undefined) {
      links = Array.isArray(body.links) ? body.links : [];
    }

    // Handle images array
    let images = funding.images;
    if (body.images !== undefined) {
      images = Array.isArray(body.images)
        ? body.images.map(img => typeof img === 'string' ? img : img.filename).filter(Boolean)
        : [];
    }

    // Simple update
    Object.assign(funding, {
      title: body.title ?? funding.title,
      categoryId: body.categoryId === '' ? null : (body.categoryId ?? funding.categoryId),
      country: body.country || null,
      city: body.city || null,
      goal: body.goal !== undefined ? Number(body.goal) : funding.goal,
      raised: body.raised !== undefined ? Number(body.raised) : funding.raised,
      currency: body.currency ?? funding.currency,
      deadline: body.deadline ?? funding.deadline,
      pitch: body.pitch ?? funding.pitch,
      rewards: body.rewards ?? funding.rewards,
      team: body.team ?? funding.team,
      email: body.email ?? funding.email,
      phone: body.phone ?? funding.phone,
      status: body.status ?? funding.status,
      visibility: body.visibility ?? funding.visibility,
      tags,
      links,
      images,

      generalCategoryId: generalCategoryId === '' ? null : generalCategoryId,
      generalSubcategoryId: generalSubcategoryId === '' ? null : generalSubcategoryId,
      generalSubsubCategoryId: generalSubsubCategoryId === '' ? null : generalSubsubCategoryId,
      industryCategoryId: industryCategoryId === '' ? null : industryCategoryId,
      industrySubcategoryId: industrySubcategoryId === '' ? null : industrySubcategoryId,
    });

    await funding.save();

    // Update audience associations if provided
    if (identityIds !== null || categoryIds !== null || subcategoryIds !== null || subsubCategoryIds !== null) {
      await setFundingAudience(funding, {
        identityIds: identityIds ?? undefined,
        categoryIds: categoryIds ?? undefined,
        subcategoryIds: subcategoryIds ?? undefined,
        subsubCategoryIds: subsubCategoryIds ?? undefined,
      });
    }

   
    await cache.deleteKeys([
      ["feed", "funding", req.user.id] 
    ]);
     await cache.deleteKeys([
          ["feed","all",req.user.id] 
        ]);
    await exports.getOne({ params: { id: funding.id }, query: { updated: true } }, res);

  } catch (err) {
    console.error("updateFunding error:", err);
    res.status(400).json({ message: err.message || "Could not update funding project" });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.query.updated;

    // Funding cache: try read first
    const __fundingCacheKey = generateFundingCacheKey(id);
    if(!updated){
      try {
        const cached = await cache.get(__fundingCacheKey);
        if (cached) {
          console.log(`✅ Funding cache hit for key: ${__fundingCacheKey}`);
          return res.json(cached);
        }
      } catch (e) {
        console.error("Funding cache read error:", e.message);
      }
    }

    const funding = await Funding.findByPk(id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "email"] },
        { model: Category, as: "category" },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });
    if (!funding) return res.status(404).json({ message: "Funding project not found" });

    try {
      await cache.set(__fundingCacheKey, funding, FUNDING_CACHE_TTL);
      console.log(`💾 Funding cached: ${__fundingCacheKey}`);
    } catch (e) {
      console.error("Funding cache write error:", e.message);
    }

    res.json(funding);
  } catch (err) {
    console.error("getOne error", err);
    res.status(500).json({ message: "Failed to fetch funding project" });
  }
};

exports.list = async (req, res) => {
  const { q, country, status, categoryId } = req.query;
  const where = {};

  if (country) where.country = country;
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;

  // Default to only showing published projects
  if (!status) where.status = "published";
  
  // Default to public visibility
  where.visibility = "public";

  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { pitch: { [Op.like]: `%${q}%` } },
      { tags: { [Op.contains]: [q] } },
    ];
  }

  const rows = await Funding.findAll({
    where,
    order: [["createdAt", "DESC"]],
    include: [
      { model: User, as: "creator", attributes: ["id", "name", "email"] },
      { model: Category, as: "category" },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });

  res.json(rows);
};

// Get funding projects created by the current user
exports.getMyProjects = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "Unauthorized" });

  const projects = await Funding.findAll({
    where: { creatorUserId: uid },
    order: [["createdAt", "DESC"]],
    include: [
      { model: Category, as: "category" },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });

  res.json(projects);
};