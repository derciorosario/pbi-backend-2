const { Job, Category, Subcategory, SubsubCategory, User } = require("../models");
const { toIdArray, normalizeIdentityIds, validateAudienceHierarchy, setJobAudience } = require("./_jobAudienceHelpers");
const { cache } = require("../utils/redis");
const { sendNewPostNotifications } = require("../cron/notificationEmails");

const JOB_CACHE_TTL = 300;

function generateJobCacheKey(jobId) {
  return `job:${jobId}`;
}

exports.createJob = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const {
      title, companyName, department, experienceLevel,
      jobType, workLocation, workSchedule,
      careerLevel, paymentType, description, requiredSkills,
      country, city, minSalary, maxSalary, currency, benefits,
      applicationDeadline, positions, applicationInstructions, contactEmail,
      categoryId, subcategoryId, status,coverImageBase64,companyId, countries,

      videoUrl,

      // Industry fields
      industryCategoryId,
      industrySubcategoryId,

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,

      // NEW (arrays are accepted as arrays or CSV):
      identityIds: _identityIds,
      categoryIds: _categoryIds,
      subcategoryIds: _subcategoryIds,
      subsubCategoryIds: _subsubCategoryIds,
    } = req.body;

    // normalize numeric fields
    const minS = (minSalary !== undefined && minSalary !== null && minSalary !== "") ? Number(minSalary) : null;
    const maxS = (maxSalary !== undefined && maxSalary !== null && maxSalary !== "") ? Number(maxSalary) : null;
    if ((minS && Number.isNaN(minS)) || (maxS && Number.isNaN(maxS))) {
      return res.status(400).json({ message: "minSalary/maxSalary must be numbers" });
    }
    if (minS !== null && maxS !== null && minS > maxS) {
      return res.status(400).json({ message: "minSalary cannot be greater than maxSalary" });
    }

    // normalize skills
    const skills = parseSkills(requiredSkills);

    // NEW: normalize audience arrays
    const identityIds = toIdArray(_identityIds);
    const categoryIds = toIdArray(_categoryIds);
    const subcategoryIds = toIdArray(_subcategoryIds);
    const subsubCategoryIds = toIdArray(_subsubCategoryIds);

    // Normalize identity names to IDs
    const normalizedIdentityIds = await normalizeIdentityIds(identityIds);

    // For backward compatibility, keep single categoryId/subcategoryId required as before.
    // If not provided, pick the first from arrays (if present).
    const primaryCategoryId = categoryId || categoryIds[0];
    if (!primaryCategoryId) {
      //return res.status(400).json({ message: "categoryId (or categoryIds[0]) is required." });
    }
    const primarySubcategoryId = subcategoryId || subcategoryIds[0] || null;

    //await validateCategoryPair(primaryCategoryId, primarySubcategoryId);
    if(categoryIds?.length || subcategoryIds?.length || subsubCategoryIds?.length) await validateAudienceHierarchy({ categoryIds: categoryIds.length ? categoryIds : [primaryCategoryId], subcategoryIds, subsubCategoryIds });

   
    // create job
    const job = await Job.create({
      title, companyName, department, experienceLevel,
      jobType, workLocation, workSchedule,
      careerLevel, paymentType, description,
      videoUrl,
      requiredSkills: skills,
      country, city,
      countries, countries,
      minSalary: minS, maxSalary: maxS, currency, benefits,
      applicationDeadline: applicationDeadline || null,
      positions: positions ? Number(positions) : 1,
      applicationInstructions, contactEmail,
      categoryId: primaryCategoryId,
      subcategoryId: primarySubcategoryId,
      status: status || "published",
      postedByUserId: req.user.id,
      coverImageBase64, // This field will now store the filename instead of base64 data
      companyId,
      industryCategoryId,
      industrySubcategoryId,

      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId
    });

    // attach audience sets (include the primary ones if arrays were empty)

   // console.log({normalizedIdentityIds,categoryIds,subcategoryIds,subsubCategoryIds})
    await setJobAudience(job, {
      identityIds: normalizedIdentityIds,
      categoryIds: categoryIds.length ? categoryIds : [primaryCategoryId],
      subcategoryIds: subcategoryIds.length ? subcategoryIds : (primarySubcategoryId ? [primarySubcategoryId] : []),
      subsubCategoryIds,
    });

    await cache.deleteKeys([
      ["feed", "jobs", req.user.id]
    ]);

    await cache.deleteKeys([
      ["feed","all",req.user.id]
    ]);

    // Send new post notifications
    try {
      const postedBy = await User.findByPk(req.user.id, { attributes: ['name', 'avatarUrl'] });
      await sendNewPostNotifications('job', {
        id: job.id,
        title: job.title,
        description: job.description,
        createdByName: postedBy.name,
        createdByAvatarUrl: postedBy.avatarUrl,
        createdAt: job.createdAt,
        creatorUserId: req.user.id,
        link: `${process.env.BASE_URL || 'https://54links.com'}/job/${job.id}`
      });
    } catch (error) {
      console.error('Error sending new post notifications for job:', error);
      // Don't fail the job creation if notifications fail
    }

    res.status(201).json({ job });
  } catch (err) {
    console.error("createJob error", err);
    res.status(400).json({ message: err.message });
  }
};



const parseSkills = (s) => {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  return String(s).split(",").map(x => x.trim()).filter(Boolean);
};

const validateCategoryPair = async (categoryId, subcategoryId) => {
  const category = await Category.findByPk(categoryId);
  if (!category) throw new Error("Invalid categoryId");

  if (subcategoryId) {
    const sub = await Subcategory.findByPk(subcategoryId);
    if (!sub) throw new Error("Invalid subcategoryId");
    if (String(sub.categoryId) !== String(categoryId)) {
      throw new Error("subcategoryId does not belong to categoryId");
    }
  }
};


exports.updateJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (String(job.postedByUserId) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const data = { ...req.body };


    // normalize skills/salary
    if (data.requiredSkills !== undefined) data.requiredSkills = parseSkills(data.requiredSkills);
    if (data.minSalary !== undefined) data.minSalary = data.minSalary === "" ? null : Number(data.minSalary);
    if (data.maxSalary !== undefined) data.maxSalary = data.maxSalary === "" ? null : Number(data.maxSalary);
    if (data.minSalary !== null && data.maxSalary !== null && data.minSalary > data.maxSalary) {
      return res.status(400).json({ message: "minSalary cannot be greater than maxSalary" });
    }
    
    // Convert empty strings to null for foreign key fields
    if (data.categoryId === '') data.categoryId = null;
    if (data.subcategoryId === '') data.subcategoryId = null;
    if (data.generalCategoryId === '') data.generalCategoryId = null;
    if (data.generalSubcategoryId === '') data.generalSubcategoryId = null;
    if (data.generalSubsubCategoryId === '') data.generalSubsubCategoryId = null;
    if (data.industryCategoryId === '') data.industryCategoryId = null;
    if (data.industrySubcategoryId === '') data.industrySubcategoryId = null;

    // primary pair validation (legacy)
    const nextCategoryId = data.categoryId ?? job.categoryId;
    const nextSubcategoryId = data.subcategoryId ?? job.subcategoryId;
   

    // NEW: optional audience arrays
    const identityIds        = data.identityIds        !== undefined ? toIdArray(data.identityIds)        : null;
    const categoryIds        = data.categoryIds        !== undefined ? toIdArray(data.categoryIds)        : null;
    const subcategoryIds     = data.subcategoryIds     !== undefined ? toIdArray(data.subcategoryIds)     : null;
    const subsubCategoryIds  = data.subsubCategoryIds  !== undefined ? toIdArray(data.subsubCategoryIds)  : null;

    // Normalize identity names to IDs if provided
    const normalizedIdentityIds = identityIds ? await normalizeIdentityIds(identityIds) : null;

    // Validate hierarchy if any of the arrays was provided
    if (categoryIds?.length || subcategoryIds?.length || subsubCategoryIds?.length) {
      await validateAudienceHierarchy({
        categoryIds: categoryIds ?? [nextCategoryId],
        subcategoryIds: subcategoryIds ?? (nextSubcategoryId ? [nextSubcategoryId] : []),
        subsubCategoryIds: subsubCategoryIds ?? [],
      });
    }

    await job.update(data);

    // Update audience sets (only those provided)
    await setJobAudience(job, {
      identityIds: normalizedIdentityIds ?? undefined,
      categoryIds: categoryIds ?? undefined,
      subcategoryIds: subcategoryIds ?? undefined,
      subsubCategoryIds: subsubCategoryIds ?? undefined,
    });

    await cache.deleteKeys([
      ["feed", "jobs", req.user.id] 
    ]);
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);

    await exports.getJob({ params: { id: job.id }, query: { updated: true } }, res);
  } catch (err) {
    console.error("updateJob error", err);
    res.status(400).json({ message: err.message });
  }
};



exports.getJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const updated = req.query.updated;


    // Job cache: try read first
    const __jobCacheKey = generateJobCacheKey(jobId);

    if(!updated){
        try {
          const cached = await cache.get(__jobCacheKey);
          if (cached) {
            console.log(`✅ Job cache hit for key: ${__jobCacheKey}`);
            return res.json(cached);
          }
        } catch (e) {
          console.error("Job cache read error:", e.message);
        }
    }

    const job = await Job.findByPk(jobId, {
      include: [
        { association: "category" },
        { association: "subcategory" },
        { association: "postedBy", attributes: ["id","name","email","accountType"] },

        // NEW
        { association: "audienceIdentities", attributes: ["id","name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id","name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id","name","categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id","name","subcategoryId"], through: { attributes: [] } },
      ],
    });
    if (!job) return res.status(404).json({ message: "Job not found" });

    const response = { job };
    try {
      await cache.set(__jobCacheKey, response, JOB_CACHE_TTL);
      console.log(`💾 Job cached: ${__jobCacheKey}`);
    } catch (e) {
      console.error("Job cache write error:", e.message);
    }
    res.json(response);
  } catch (err) {
    console.error("getJob error", err);
    res.status(500).json({ message: "Failed to fetch job" });
  }
};

exports.listJobs = async (req, res) => {

  const { categoryId, subcategoryId, country, q } = req.query;
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (subcategoryId) where.subcategoryId = subcategoryId;
  if (country) where.country = country;
  if (q) where.title = { [require("sequelize").Op.like]: `%${q}%` };

  const jobs = await Job.findAll({
    where,
    order: [["createdAt","DESC"]],
    include: [{ association: "category" }, { association: "subcategory" }],
  });
  res.json({ jobs });
  
};

exports.deleteJob = async (req, res) => {
  try {
    const id = req.params.id;
    const job = await Job.findByPk(id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    if (String(job.postedByUserId) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await job.destroy();
     await cache.deleteKeys([
      ["feed", "jobs", req.user.id] 
    ])
    
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);
    res.json({ message: "Job deleted successfully" });
  } catch (err) {
    console.error("deleteJob error", err);
    res.status(400).json({ message: err.message });
  }
};

// Handle cover image upload
exports.uploadCoverImage = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Return the S3 URL that was saved in req.savedFileUrl during upload
    const s3Url = req.savedFileUrl;

    res.status(200).json({
      success: true,
      filename: req.file.filename,
      url: s3Url, // S3 URL for the uploaded file
      filePath: s3Url // Use S3 URL as the file path
    });
  } catch (err) {
    console.error("uploadCoverImage error", err);
    res.status(500).json({ message: err.message });
  }
};

