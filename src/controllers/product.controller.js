const { Product, Category, Subcategory, SubsubCategory, User } = require("../models");
const { Op } = require("sequelize");
const { toIdArray, normalizeIdentityIds, validateAudienceHierarchy, setProductAudience } = require("./_productAudienceHelpers");
const { cache } = require("../utils/redis");

const PRODUCT_CACHE_TTL = 300;

function generateProductCacheKey(productId) {
  return `product:${productId}`;
}

exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    order: [["name", "ASC"]],
    include: [{ model: Subcategory, as: "subcategories", order: [["name", "ASC"]] }],
  });

  const productTypes = ["Physical Product", "Digital Product", "Service"];
  const priceTypes = ["Fixed Price", "Negotiable"];
  const deliveryTimes = ["Immediate", "1-3 Days", "1 Week", "2 Weeks", "Custom"];
  const locationTypes = ["Local Pickup", "Shipping", "Digital Delivery"];
  const conditionTypes = ["New", "Used", "Refurbished"];

  res.json({
    categories,
    productTypes,
    priceTypes,
    deliveryTimes,
    locationTypes,
    conditionTypes
  });
};


exports.deleteProduct = async (req, res) => {
  try {
    const id = req.params.id;
    const item = await Product.findByPk(id);
    if (!item) return res.status(404).json({ message: "Post not found" });
    if (String(item.sellerUserId) !== String(req.user?.id) && req.user?. accountType!="admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await item.destroy();
     await cache.deleteKeys([
      ["feed", "products", req.user.id] 
    ])
    
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("delete post error", err);
    res.status(400).json({ message: err.message });
  }
};


exports.create = async (req, res) => {
  try {
    const uid = req.user?.id; // from auth middleware
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      categoryId,
      subcategoryId,
      price,
      quantity,
      description,
      country,
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
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "At least one product image is required" });
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

    // Create product
    const product = await Product.create({
      sellerUserId: uid,
      title,
      price: price ? Number(price) : null,
      quantity: quantity ? Number(quantity) : null,
      description,
      country,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(s => s.trim()) : []),
      /*images: Array.isArray(images) ? images.map(img => ({
        filename: img.filename,
        title: img.title
      })) : [],*/

      images,

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,
      industryCategoryId,
      industrySubcategoryId,
    });

    // Set audience associations
    await setProductAudience(product, {
      identityIds,
      categoryIds,
      subcategoryIds,
      subsubCategoryIds
    });

    const created = await Product.findByPk(product.id, {
      include: [
        { model: User, as: "seller", attributes: ["id", "name", "email"] },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });

    await cache.deleteKeys([
      ["feed", "products", req.user.id] 
    ]);

    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);

    res.status(201).json(created);
  } catch (err) {
    console.error("createProduct error:", err);
    res.status(400).json({ message: err.message || "Could not create product" });
  }
};

exports.update = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.sellerUserId !== uid && req.user?.accountType !== "admin") {
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
      images,

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
    let tags = product.tags;
    if (body.tags !== undefined) {
      tags = Array.isArray(body.tags)
        ? body.tags
        : (typeof body.tags === 'string' ? body.tags.split(',').map(s => s.trim()) : []);
    }

   

    // Simple update
    Object.assign(product, {
      title: body.title ?? product.title,
      categoryId: body.categoryId === '' ? null : (body.categoryId ?? product.categoryId),
      subcategoryId: body.subcategoryId === '' ? null : (body.subcategoryId ?? product.subcategoryId),
      price: body.price !== undefined ? (body.price ? Number(body.price) : null) : product.price,
      quantity: body.quantity !== undefined ? (body.quantity ? Number(body.quantity) : null) : product.quantity,
      description: body.description ?? product.description,
      country: body.country || null,
      city: body.city || null,
      tags,
      images,
      generalCategoryId: generalCategoryId === '' ? null : generalCategoryId,
      generalSubcategoryId: generalSubcategoryId === '' ? null : generalSubcategoryId,
      generalSubsubCategoryId: generalSubsubCategoryId === '' ? null : generalSubsubCategoryId,
      industryCategoryId: industryCategoryId === '' ? null : industryCategoryId,
      industrySubcategoryId: industrySubcategoryId === '' ? null : industrySubcategoryId,
    });

    await product.save();

    // Update audience associations if provided
    if (identityIds !== null || categoryIds !== null || subcategoryIds !== null || subsubCategoryIds !== null) {
      await setProductAudience(product, {
        identityIds: identityIds ?? undefined,
        categoryIds: categoryIds ?? undefined,
        subcategoryIds: subcategoryIds ?? undefined,
        subsubCategoryIds: subsubCategoryIds ?? undefined,
      });
    }

    await cache.deleteKeys([
      ["feed", "products", req.user.id] 
    ]);
    
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);

    await exports.getOne({ params: { id: product.id }, query: { updated: true } }, res);

  } catch (err) {
    console.error("updateProduct error:", err);
    res.status(400).json({ message: err.message || "Could not update product" });
  }

};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.query.updated;

    // Product cache: try read first
    const __productCacheKey = generateProductCacheKey(id);

    if(!updated){
        try {
          const cached = await cache.get(__productCacheKey);
          if (cached) {
            console.log(`Product cache hit for key: ${__productCacheKey}`);
            return res.json(cached);
          }
        } catch (e) {
          console.error("Product cache read error:", e.message);
        }
    }

    const product = await Product.findByPk(id, {
      include: [
        { model: User, as: "seller", attributes: ["id", "name", "email"] },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });
    if (!product) return res.status(404).json({ message: "Product not found" });

    try {
      await cache.set(__productCacheKey, product, PRODUCT_CACHE_TTL);
      console.log(`💾 Product cached: ${__productCacheKey}`);
    } catch (e) {
      console.error("Product cache write error:", e.message);
    }

    res.json(product);
  } catch (err) {
    console.error("getOne error", err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
};

exports.list = async (req, res) => {
  const { q , country } = req.query;
  const where = {};

  if (country) where.country = country;

  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
      { tags: { [Op.contains]: [q] } },
    ];
  }

  const rows = await Product.findAll({
    where,
    order: [["createdAt", "DESC"]],
    include: [
      { model: User, as: "seller", attributes: ["id", "name", "email"] },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });

  res.json(rows);
};

// Get products sold by the current user
exports.getMyProducts = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "Unauthorized" });

  const products = await Product.findAll({
    where: { sellerUserId: uid },
    order: [["createdAt", "DESC"]],
    include: [
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });

  res.json(products);
};

// Handle multiple image uploads
exports.uploadImages = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Return the filenames to be stored in the database
    const filenames = req.files.map(file => file.filename);
    const filePaths = filenames.map(filename => `/uploads/${filename}`);

    res.status(200).json({
      success: true,
      filenames: filenames,
      filePaths: filePaths
    });
  } catch (err) {
    console.error("uploadImages error", err);
    res.status(500).json({ message: err.message });
  }
};