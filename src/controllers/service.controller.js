const { Service, Category, Subcategory, SubsubCategory, User } = require("../models");
const { Op } = require("sequelize");
const { toIdArray, normalizeIdentityIds, validateAudienceHierarchy, setServiceAudience } = require("./_serviceAudienceHelpers");
const { cache } = require("../utils/redis");

const SERVICE_CACHE_TTL = 300;

function generateServiceCacheKey(serviceId) {
  return `service:${serviceId}`;
}

exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    order: [["name", "ASC"]],
    include: [{ model: Subcategory, as: "subcategories", order: [["name", "ASC"]] }],
  });

  const serviceTypes = ["Consulting", "Freelance Work", "Product/Service"];
  const priceTypes = ["Fixed Price", "Hourly"];
  const deliveryTimes = ["1 Day", "3 Days", "1 Week", "2 Weeks", "1 Month"];
  const locationTypes = ["Remote", "On-site"];
  const experienceLevels = ["Entry Level", "Intermediate", "Expert"];

  res.json({
    categories,
    serviceTypes,
    priceTypes,
    deliveryTimes,
    locationTypes,
    experienceLevels
  });
};

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
    const uid = req.user?.id; // from auth middleware
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      serviceType,
      description,
      priceAmount,
      priceType,
      deliveryTime,
      locationType,
      experienceLevel,
      country,
      city,
      skills,
      attachments,
      categoryId,
      subcategoryId,

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
    if (!serviceType) return res.status(400).json({ message: "Service type is required" });
    if (!locationType) return res.status(400).json({ message: "Location type is required" });
    if (locationType === "On-site" && !country) {
      return res.status(400).json({ message: "Country is required for on-site services" });
    }

    // Normalize audience arrays
    const identityIds = await normalizeIdentityIds(toIdArray(_identityIds));
    const categoryIds = toIdArray(_categoryIds);
    const subcategoryIds = toIdArray(_subcategoryIds);
    const subsubCategoryIds = toIdArray(_subsubCategoryIds);

    // For backward compatibility, keep single categoryId/subcategoryId as before
    const primaryCategoryId = categoryId || categoryIds[0] || null;
    const primarySubcategoryId = subcategoryId || subcategoryIds[0] || null;

    // Validate category/subcategory pair (optional)
    if (primarySubcategoryId) {
      const sub = await Subcategory.findByPk(primarySubcategoryId);
      if (!sub) return res.status(400).json({ message: "Invalid subcategory" });
      if (primaryCategoryId && String(sub.categoryId) !== String(primaryCategoryId)) {
        return res.status(400).json({ message: "Subcategory does not belong to selected category" });
      }
    }

    // Validate audience hierarchy
    if (categoryIds.length || subcategoryIds.length || subsubCategoryIds.length) {
      try {
        await validateAudienceHierarchy({
          categoryIds: categoryIds.length ? categoryIds : (primaryCategoryId ? [primaryCategoryId] : []),
          subcategoryIds: subcategoryIds.length ? subcategoryIds : (primarySubcategoryId ? [primarySubcategoryId] : []),
          subsubCategoryIds
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // Create service
    const service = await Service.create({
      providerUserId: uid,
      title,
      serviceType,
      description,
      priceAmount: priceAmount ? Number(priceAmount) : null,
      priceType,
      deliveryTime,
      locationType,
      experienceLevel,
      country:  country || null,
      city:  city || null,
      skills: Array.isArray(skills) ? skills : (typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : []),
      attachments: Array.isArray(attachments) ? attachments : [],
      categoryId: primaryCategoryId,
      subcategoryId: primarySubcategoryId,
      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,
      industryCategoryId,
      industrySubcategoryId,
    });

    // Set audience associations
    await setServiceAudience(service, {
      identityIds,
      categoryIds: categoryIds.length ? categoryIds : (primaryCategoryId ? [primaryCategoryId] : []),
      subcategoryIds: subcategoryIds.length ? subcategoryIds : (primarySubcategoryId ? [primarySubcategoryId] : []),
      subsubCategoryIds
    });

    const created = await Service.findByPk(service.id, {
      include: [
        { model: User, as: "provider", attributes: ["id", "name", "email"] },
        { model: Category, as: "category" },
        { model: Subcategory, as: "subcategory" },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });

     await cache.deleteKeys([
      ["feed", "services", req.user.id] 
    ]);
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);

    res.status(201).json(created);
  } catch (err) {
    console.error("createService error:", err);
    res.status(400).json({ message: err.message || "Could not create service" });
  }
};

exports.update = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (service.providerUserId !== uid && req.user?.accountType !== "admin") {
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
          categoryIds: categoryIds ?? [service.categoryId].filter(Boolean),
          subcategoryIds: subcategoryIds ?? [service.subcategoryId].filter(Boolean),
          subsubCategoryIds: subsubCategoryIds ?? [],
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // Handle skills array
    let skills = service.skills;
    if (body.skills !== undefined) {
      skills = Array.isArray(body.skills) 
        ? body.skills 
        : (typeof body.skills === 'string' ? body.skills.split(',').map(s => s.trim()) : []);
    }

    // Handle attachments array
    let attachments = service.attachments;
    if (body.attachments !== undefined) {
      attachments = Array.isArray(body.attachments)
        ? body.attachments.map(a => typeof a === 'string' ? a : a.filename).filter(Boolean)
        : [];
    }

    // Simple update
    Object.assign(service, {
      title: body.title ?? service.title,
      serviceType: body.serviceType ?? service.serviceType,
      description: body.description ?? service.description,
      priceAmount: body.priceAmount !== undefined ? (body.priceAmount ? Number(body.priceAmount) : null) : service.priceAmount,
      priceType: body.priceType ?? service.priceType,
      deliveryTime: body.deliveryTime ?? service.deliveryTime,
      locationType: body.locationType ?? service.locationType,
      country:  body.country || null,
      city:  body.city || null,
      experienceLevel: body.experienceLevel ?? service.experienceLevel,
      categoryId: body.categoryId === '' ? null : (body.categoryId ?? service.categoryId),
      subcategoryId: body.subcategoryId === '' ? null : (body.subcategoryId ?? service.subcategoryId),
      skills,
      attachments: attachments ? attachments.map(a => typeof a === 'string' ? a : a.filename).filter(Boolean) : [],
      generalCategoryId: generalCategoryId === '' ? null : generalCategoryId,
      generalSubcategoryId: generalSubcategoryId === '' ? null : generalSubcategoryId,
      generalSubsubCategoryId: generalSubsubCategoryId === '' ? null : generalSubsubCategoryId,
      industryCategoryId: industryCategoryId === '' ? null : industryCategoryId,
      industrySubcategoryId: industrySubcategoryId === '' ? null : industrySubcategoryId,
    });

    // Handle location fields based on locationType
   /* if (service.locationType === "Remote") {
      service.country = null;
      service.city = null;
    } else {
      service.country = body.country ?? service.country;
      service.city = body.city ?? service.city;
    }*/

      

    await service.save();

    // Update audience associations if provided
    if (identityIds !== null || categoryIds !== null || subcategoryIds !== null || subsubCategoryIds !== null) {
      await setServiceAudience(service, {
        identityIds: identityIds ?? undefined,
        categoryIds: categoryIds ?? undefined,
        subcategoryIds: subcategoryIds ?? undefined,
        subsubCategoryIds: subsubCategoryIds ?? undefined,
      });
    }

    await cache.deleteKeys([
      ["feed", "services", req.user.id] 
    ]);
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);
   
    await exports.getOne({ params: { id: service.id }, query: { updated: true } }, res);
  } catch (err) {
    console.error("updateService error:", err);
    res.status(400).json({ message: err.message || "Could not update service" });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.query.updated;

    // Service cache: try read first
    const __serviceCacheKey = generateServiceCacheKey(id);

    if(!updated){
         try {
      const cached = await cache.get(__serviceCacheKey);
      if (cached) {
        console.log(`✅ Service cache hit for key: ${__serviceCacheKey}`);
        return res.json(cached);
      }
    } catch (e) {
      console.error("Service cache read error:", e.message);
    }

    }

 

    const service = await Service.findByPk(id, {
      include: [
        { model: User, as: "provider", attributes: ["id", "name", "email"] },
        { model: Category, as: "category" },
        { model: Subcategory, as: "subcategory" },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });

    if (!service) return res.status(404).json({ message: "Service not found" });

    try {
      await cache.set(__serviceCacheKey, service, SERVICE_CACHE_TTL);
      console.log(`💾 Service cached: ${__serviceCacheKey}`);
    } catch (e) {
      console.error("Service cache write error:", e.message);
    }

    res.json(service);
  } catch (err) {
    console.error("getOne error", err);
    res.status(500).json({ message: "Failed to fetch service" });
  }
};

exports.list = async (req, res) => {
  const { q, categoryId, serviceType, locationType, country } = req.query;
  const where = {};
  
  if (categoryId) where.categoryId = categoryId;
  if (serviceType) where.serviceType = serviceType;
  if (locationType) where.locationType = locationType;
  if (country) where.country = country;
  
  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
    ];
  }
  
  const rows = await Service.findAll({
    where,
    order: [["createdAt", "DESC"]],
    include: [
      { model: User, as: "provider", attributes: ["id", "name", "email"] },
      { model: Category, as: "category" },
      { model: Subcategory, as: "subcategory" },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });
  
  res.json(rows);
};

exports.deleteService = async (req, res) => {
  try {
    const id = req.params.id;
    const service = await Service.findByPk(id);
    if (!service) return res.status(404).json({ message: "Service not found" });
    if (String(service.providerUserId) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await service.destroy();

     await cache.deleteKeys([
      ["feed", "services", req.user.id] 
    ]);
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);
    
    res.json({ message: "Service deleted successfully" });
  } catch (err) {
    console.error("deleteService error", err);
    res.status(400).json({ message: err.message });
  }
};

// Get services provided by the current user
exports.getMyServices = async (req, res) => {
  const uid = req.user?.id;
  if (!uid) return res.status(401).json({ message: "Unauthorized" });

  const services = await Service.findAll({
    where: { providerUserId: uid },
    order: [["createdAt", "DESC"]],
    include: [
      { model: Category, as: "category" },
      { model: Subcategory, as: "subcategory" },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });

  res.json(services);
};