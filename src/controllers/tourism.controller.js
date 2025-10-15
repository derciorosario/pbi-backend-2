const { Tourism, Category, Subcategory, SubsubCategory, User } = require("../models");
const { Op } = require("sequelize");
const { toIdArray, normalizeIdentityIds, validateAudienceHierarchy, setTourismAudience } = require("./_tourismAudienceHelpers");
const { cache } = require("../utils/redis");

const TOURISM_CACHE_TTL = 300;

function generateTourismCacheKey(tourismId) {
  return `tourism:${tourismId}`;
}

exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    order: [["name", "ASC"]],
    include: [{ model: Subcategory, as: "subcategories", order: [["name", "ASC"]] }],
  });

  const postTypes = ["Destination", "Experience", "Culture"];
  const seasons = ["Summer", "Winter", "All Year", "Rainy Season", "Dry Season"];
  const budgetRanges = ["$100 - $500", "$500 - $2000", "$2000+"];

  res.json({
    categories,
    postTypes,
    seasons,
    budgetRanges
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
      postType,
      title,
      country,
      location,
      description,
      season,
      budgetRange,
      tags,
      images,

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
    if (!title || !description) return res.status(400).json({ message: "Title and description are required" });
    if (!country) return res.status(400).json({ message: "Country is required" });
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

    // Create tourism post
    const tourism = await Tourism.create({
      authorUserId: uid,
      postType: postType || "Destination",
      title,
      description,
      country,
      location: location || null,
      season: season || null,
      budgetRange: budgetRange || null,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(s => s.trim()) : []),
      images: Array.isArray(images) ? images.map(img => typeof img === 'string' ? img : img.filename).filter(Boolean) : [],

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,
      industryCategoryId,
      industrySubcategoryId,
    });

    // Set audience associations
    await setTourismAudience(tourism, {
      identityIds,
      categoryIds,
      subcategoryIds,
      subsubCategoryIds
    });

    const created = await Tourism.findByPk(tourism.id, {
      include: [
        { model: User, as: "author", attributes: ["id", "name", "email"] },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });

     await cache.deleteKeys([
      ["feed", "tourism", req.user.id] 
    ]);
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);

    res.status(201).json(created);
  } catch (err) {
    console.error("createTourism error:", err);
    res.status(400).json({ message: err.message || "Could not create tourism post" });
  }
};

exports.update = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const tourism = await Tourism.findByPk(id);
    if (!tourism) return res.status(404).json({ message: "Tourism post not found" });
    if (tourism.authorUserId !== uid && req.user?.accountType !== "admin") {
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
    let tags = tourism.tags;
    if (body.tags !== undefined) {
      tags = Array.isArray(body.tags)
        ? body.tags
        : (typeof body.tags === 'string' ? body.tags.split(',').map(s => s.trim()) : []);
    }

    // Handle images array
    let images = tourism.images;
    if (body.images !== undefined) {
      images = Array.isArray(body.images)
        ? body.images.map(img => typeof img === 'string' ? img : img.filename).filter(Boolean)
        : [];
    }

    // Simple update
    Object.assign(tourism, {
      postType: body.postType ?? tourism.postType,
      title: body.title ?? tourism.title,
      country: body.country || null,
      city: body.city || null,
      location: body.location ?? tourism.location,
      description: body.description ?? tourism.description,
      season: body.season ?? tourism.season,
      budgetRange: body.budgetRange ?? tourism.budgetRange,
      tags,
      images,
      generalCategoryId: generalCategoryId === '' ? null : generalCategoryId,
      generalSubcategoryId: generalSubcategoryId === '' ? null : generalSubcategoryId,
      generalSubsubCategoryId: generalSubsubCategoryId === '' ? null : generalSubsubCategoryId,
      industryCategoryId: industryCategoryId === '' ? null : industryCategoryId,
      industrySubcategoryId: industrySubcategoryId === '' ? null : industrySubcategoryId,
    });

    await tourism.save();

    // Update audience associations if provided
    if (identityIds !== null || categoryIds !== null || subcategoryIds !== null || subsubCategoryIds !== null) {
      await setTourismAudience(tourism, {
        identityIds: identityIds ?? undefined,
        categoryIds: categoryIds ?? undefined,
        subcategoryIds: subcategoryIds ?? undefined,
        subsubCategoryIds: subsubCategoryIds ?? undefined,
      });
    }
    await cache.deleteKeys([
      ["feed", "tourism", req.user.id] 
    ]);
     await cache.deleteKeys([
          ["feed","all",req.user.id] 
    ]);
    await exports.getOne({ params: { id: tourism.id }, query: { updated: true } }, res);
    
  } catch (err) {
    console.error("updateTourism error:", err);
    res.status(400).json({ message: err.message || "Could not update tourism post" });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
     const updated = req.query.updated;

    // Tourism cache: try read first
    const __tourismCacheKey = generateTourismCacheKey(id);
  
    if(!updated){
      try {
        const cached = await cache.get(__tourismCacheKey);
        if (cached) {
          console.log(`✅ Tourism cache hit for key: ${__tourismCacheKey}`);
          return res.json(cached);
        }
      } catch (e) {
        console.error("Tourism cache read error:", e.message);
      }
    }
    const tourism = await Tourism.findByPk(id, {
      include: [
        { model: User, as: "author", attributes: ["id", "name", "email"] },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });
    if (!tourism) return res.status(404).json({ message: "Tourism post not found" });

    try {
      await cache.set(__tourismCacheKey, tourism, TOURISM_CACHE_TTL);
      console.log(`💾 Tourism cached: ${__tourismCacheKey}`);
    } catch (e) {
      console.error("Tourism cache write error:", e.message);
    }

    res.json(tourism);
  } catch (err) {
    console.error("getOne error", err);
    res.status(500).json({ message: "Failed to fetch tourism post" });
  }
};

exports.list = async (req, res) => {
  const { q, country, postType } = req.query;
  const where = {};

  if (country) where.country = country;
  if (postType) where.postType = postType;

  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
      { tags: { [Op.contains]: [q] } },
    ];
  }

  const rows = await Tourism.findAll({
    where,
    order: [["createdAt", "DESC"]],
    include: [
      { model: User, as: "author", attributes: ["id", "name", "email"] },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });

  res.json(rows);
};

// Get tourism posts created by the current user
exports.getMyPosts = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "Unauthorized" });

  const posts = await Tourism.findAll({
    where: { authorUserId: uid },
    order: [["createdAt", "DESC"]],
    include: [
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });

  res.json(posts);
};