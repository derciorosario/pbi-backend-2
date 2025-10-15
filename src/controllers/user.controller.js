// src/controllers/profile.controller.js
const { Op } = require("sequelize");
const {
  User, Profile,
  Identity, Category, Subcategory, SubsubCategory,
  UserIdentity, UserCategory, UserSubcategory, UserSubsubCategory,
  UserIdentityInterest, UserCategoryInterest, UserSubcategoryInterest, UserSubsubCategoryInterest,
  Goal, UserGoal,
  Job, Event, Service, Product, Tourism, Funding,
  Connection, ConnectionRequest,
  MeetingRequest, CompanyStaff,
  WorkSample
} = require("../models");
const { cache } = require("../utils/redis");
const { getBlockStatus } = require("../utils/blocking");

const USER_CACHE_TTL = 300;

function generateProfileCacheKey(userId, viewerId) {
  return `profile:${userId}:${viewerId || 'anonymous'}`;
}

function generateSearchUsersCacheKey(q, currentUserId) {
  return `searchUsers:${q}:${currentUserId || 'anonymous'}`;
}

function generateCompaniesCacheKey(q, limit) {
  return `companies:${q || ''}:${limit || 'default'}`;
}

const normalizePair = (id1, id2) => {
  const a = String(id1);
  const b = String(id2);
  return a < b ? [a, b] : [b, a];
};

const toPublicUser = (u) => ({
  id: u.id,
  name: u.name,
  title: u.profile?.professionalTitle || null,
  city: u.city || null,
  country: u.country || null,
  avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
});





exports.getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    // User profile cache: try read first
    const __profileCacheKey = generateProfileCacheKey(id, viewerId);
    try {
      const cached = await cache.get(__profileCacheKey);
      if (cached) {
        console.log(`✅ Profile cache hit for key: ${__profileCacheKey}`);
        return res.json(cached);
      }
    } catch (e) {
      console.error("Profile cache read error:", e.message);
    }

    // ── Base user with taxonomy selections kept as before ─────────────────────
    const user = await User.findByPk(id, {
      attributes: ["id", "name", "email", "accountType", "country", "city", "avatarUrl", "createdAt"],
      include: [
        {
          model: Profile, as: "profile",
          include: [{
            model: WorkSample, as: "workSamples",
            where: (viewerId && String(viewerId) === String(id)) ? undefined : { isPublic: true },
            required: false,
            attributes: [
              "id","title","description","projectUrl","imageBase64","imageFileName",
              "category","technologies","attachments","completionDate","isPublic","createdAt","updatedAt"
            ],
            order: [["createdAt","DESC"]],
          }]
        },

        // ⬇️ keep these as-is
        { model: Goal,         as: "goals",           attributes: ["id", "name"], through: { attributes: [] } },
        { model: Identity,     as: "identities",      attributes: ["id", "name"], through: { attributes: [] } },
        { model: Category,     as: "categories",      attributes: ["id", "name"], through: { attributes: [] } },
        { model: Subcategory,  as: "subcategories",   attributes: ["id", "name"], through: { attributes: [] } },
        { model: SubsubCategory, as: "subsubcategories", attributes: ["id", "name"], through: { attributes: [] } },

        // ⛔️ removed the 4 *Interest includes here

        // Keep company staff include
        {
          model: CompanyStaff,
          as: "staffOf",
          where: { status: "confirmed" },
          required: false,
          include: [
            {
              model: User,
              as: "company",
              attributes: ["id", "name", "avatarUrl"],
              include: [{ model: Profile, as: "profile", attributes: ["avatarUrl"], required: false }]
            }
          ]
        },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.accountType === "admin") return res.status(404).json({ message: "User not found" });

    // ── Interests fetched separately (same final shape) ───────────────────────
    const [
      identityInterestsRows,
      categoryInterestsRows,
      subcategoryInterestsRows,
      subsubInterestsRows,
    ] = await Promise.all([
      UserIdentityInterest.findAll({
        where: { userId: id },
        include: [{ model: Identity, as: "identity", attributes: ["id", "name"] }],
      }),
      UserCategoryInterest.findAll({
        where: { userId: id },
        include: [{ model: Category, as: "category", attributes: ["id", "name"] }],
      }),
      UserSubcategoryInterest.findAll({
        where: { userId: id },
        include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"] }],
      }),
      UserSubsubCategoryInterest.findAll({
        where: { userId: id },
        include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"] }],
      }),
    ]);

    // ── Counts, recents, connections, meetings (unchanged) ────────────────────
    const [jobsCount, eventsCount, servicesCount, productsCount, tourismCount, fundingCount] = await Promise.all([
      Job.count({ where: { postedByUserId: user.id } }),
      Event.count({ where: { organizerUserId: user.id } }),
      Service.count({ where: { providerUserId: user.id } }),
      Product.count({ where: { sellerUserId: user.id } }),
      Tourism.count({ where: { authorUserId: user.id } }),
      Funding.count({ where: { creatorUserId: user.id } }),
    ]);

    const [recentJobs, recentEvents, recentServices, recentProducts, recentFunding] = await Promise.all([
      Job.findAll({
        where: { postedByUserId: user.id },
        limit: 3,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "companyName", "city", "country", "createdAt"],
      }),
      Event.findAll({
        where: { organizerUserId: user.id },
        limit: 3,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "city", "country", "startAt", "createdAt", "registrationType", "price", "currency"],
      }),
      Service.findAll({
        where: { providerUserId: user.id },
        limit: 3,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "priceAmount", "priceType", "deliveryTime", "createdAt"],
      }),
      Product.findAll({
        where: { sellerUserId: user.id },
        limit: 3,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "price", "createdAt"],
      }),
      Funding.findAll({
        where: { creatorUserId: user.id },
        limit: 3,
        order: [["createdAt", "DESC"]],
        attributes: ["id", "title", "goal", "raised", "currency", "deadline", "createdAt"],
      }),
    ]);

    const connections = await Connection.count({
      where: { [Op.or]: [{ userOneId: user.id }, { userTwoId: user.id }] },
    });

    let connectionStatus = "none";
    if (viewerId && String(viewerId) !== String(user.id)) {
      const [a, b] = normalizePair(viewerId, user.id);
      const [accepted, outgoingReq, incomingReq] = await Promise.all([
        Connection.findOne({ where: { userOneId: a, userTwoId: b } }),
        ConnectionRequest.findOne({ where: { status: "pending", fromUserId: viewerId, toUserId: user.id } }),
        ConnectionRequest.findOne({ where: { status: "pending", fromUserId: user.id, toUserId: viewerId } }),
      ]);
      if (accepted) connectionStatus = "connected";
      else if (outgoingReq) connectionStatus = "outgoing_pending";
      else if (incomingReq) connectionStatus = "incoming_pending";
    } else if (viewerId && String(viewerId) === String(user.id)) {
      connectionStatus = "self";
    }

    let meetings = [];
    if (viewerId && String(viewerId) !== String(user.id)) {
      meetings = await MeetingRequest.findAll({
        where: {
          [Op.or]: [
            { [Op.and]: [{ fromUserId: user.id },   { toUserId: viewerId }] },
            { [Op.and]: [{ fromUserId: viewerId },  { toUserId: user.id  }] },
          ],
        },
        order: [["scheduledAt", "DESC"]],
        limit: 5,
        include: [
          { model: User, as: "requester", attributes: ["id", "name", "avatarUrl", "city", "country"] },
          { model: User, as: "recipient", attributes: ["id", "name", "avatarUrl", "city", "country"] },
        ],
      });
    }

    const meetingsBlock = meetings.map(m => ({
      id: m.id,
      title: m.title,
      agenda: m.agenda,
      scheduledAt: m.scheduledAt,
      duration: m.duration,
      timezone: m.timezone,
      mode: m.mode,
      location: m.location,
      link: m.link,
      status: m.status,
      createdAt: m.createdAt,
      from: toPublicUser(m.requester),
      to: toPublicUser(m.recipient),
    }));

    // account-type extras
    let accountDetails = {};
    if (user.accountType === "individual") {
      accountDetails = {
        type: "individual",
        professionalTitle: user.profile?.professionalTitle,
        experienceLevel: user.profile?.experienceLevel,
      };
    } else if (user.accountType === "company") {
      accountDetails = {
        type: "company",
        professionalTitle: user.profile?.professionalTitle,
        experienceLevel: user.profile?.experienceLevel,
        categories: user.categories?.map(c => c.name) || [],
      };
    }

    const block = await getBlockStatus(viewerId, user.id);

    const workSamples = Array.isArray(user.profile?.workSamples)
      ? user.profile.workSamples.map(ws => ({
          id: ws.id,
          title: ws.title,
          description: ws.description,
          projectUrl: ws.projectUrl,
          imageBase64: ws.imageBase64,
          imageFileName: ws.imageFileName,
          category: ws.category,
          technologies: Array.isArray(ws.technologies) ? ws.technologies : [],
          attachments: Array.isArray(ws.attachments) ? ws.attachments : [],
          completionDate: ws.completionDate,
          isPublic: !!ws.isPublic,
          createdAt: ws.createdAt,
        }))
      : [];

    // ── Payload (interests use the separately-fetched rows) ───────────────────
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      city: user.city,
      country: user.country,
      avatarUrl: user.profile?.avatarUrl || user.avatarUrl,
      professionalTitle: user.profile?.professionalTitle,
      about: user.profile?.about,
      experienceLevel: user.profile?.experienceLevel,
      skills: user.profile?.skills || [],
      languages: user.profile?.languages || [],
      primaryIdentity: user.profile?.primaryIdentity,
      cvBase64: user.profile?.cvBase64 || [],
      memberSince: user.createdAt,

      workSamples,

      companyMemberships: user.staffOf?.map(staff => ({
        id: staff.id,
        companyId: staff.companyId,
        role: staff.role,
        isMain: staff.isMain,
        joinedAt: staff.confirmedAt,
        company: {
          id: staff.company.id,
          name: staff.company.name,
          avatarUrl: staff.company.profile?.avatarUrl || staff.company.avatarUrl,
        }
      })) || [],

      // Selected taxonomy (unchanged)
      identities: user.identities?.map(i => i.name) || [],
      categories:  user.categories?.map(c => c.name) || [],
      subcategories: user.subcategories?.map(s => s.name) || [],
      subsubs: user.subsubcategories?.map(s3 => s3.name) || [],

      // Interests (now from separate queries)
      interests: {
        identities: identityInterestsRows?.map(ii => ii.identity?.name) || [],
        categories:  categoryInterestsRows?.map(ci => ci.category?.name) || [],
        subcategories: subcategoryInterestsRows?.map(si => si.subcategory?.name) || [],
        subsubs:     subsubInterestsRows?.map(ssi => ssi.subsubCategory?.name) || [],
      },

      // Goals (unchanged)
      goals: user.goals?.map(g => g.name) || [],

      // Activity
      stats: {
        jobs: jobsCount,
        events: eventsCount,
        services: servicesCount,
        products: productsCount,
        tourism: tourismCount,
        funding: fundingCount,
        connections,
      },
      recent: {
        jobs: recentJobs,
        events: recentEvents,
        services: recentServices,
        products: recentProducts,
        funding: recentFunding,
      },

      ...accountDetails,
      meetings: meetingsBlock,
      block,
      connectionStatus,
    };

    try {
      await cache.set(__profileCacheKey, payload, USER_CACHE_TTL);
      console.log(`💾 Profile cached: ${__profileCacheKey}`);
    } catch (e) {
      console.error("Profile cache write error:", e.message);
    }

    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};



/**
 * Search for users by name or email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.sub;

    if (!q || q.length < 3) {
      return res.json([]);
    }

    // Search users cache: try read first
    const __searchCacheKey = generateSearchUsersCacheKey(q, currentUserId);
    try {
      const cached = await cache.get(__searchCacheKey);
      if (cached) {
        console.log(`✅ Search users cache hit for key: ${__searchCacheKey}`);
        return res.json(cached);
      }
    } catch (e) {
      console.error("Search users cache read error:", e.message);
    }
    
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } }
        ],
        id: { [Op.ne]: currentUserId }, // Exclude current user
        accountType: { [Op.ne]: "admin" } // Exclude admin users
      },
      include: [
        {
          model: Profile,
          as: "profile",
          attributes: ["professionalTitle", "avatarUrl"],
          required: false
        }
      ],
      attributes: ["id", "name", "email", "avatarUrl", "city", "country","accountType"],
      limit: 10
    });
    
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.profile?.avatarUrl || user.avatarUrl,
      professionalTitle: user.profile?.professionalTitle || null,
      city: user.city || null,
      country: user.country || null,
      accountType:user.accountType
    }));

    try {
      await cache.set(__searchCacheKey, formattedUsers, USER_CACHE_TTL);
      console.log(`💾 Search users cached: ${__searchCacheKey}`);
    } catch (e) {
      console.error("Search users cache write error:", e.message);
    }

    res.json(formattedUsers);
  } catch (error) {
    next(error);
  }
};


/**
 * GET /companies
 * List users whose accountType === "company"
 * Optional ?q= filter by name/email (frontend does client-side search too)
 */
exports.listCompanies = async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    const where = { accountType: "company" };

    // Companies cache: try read first
    const __companiesCacheKey = generateCompaniesCacheKey(q, limit);
    try {
      const cached = await cache.get(__companiesCacheKey);
      if (cached) {
        console.log(`✅ Companies cache hit for key: ${__companiesCacheKey}`);
        return res.json(cached);
      }
    } catch (e) {
      console.error("Companies cache read error:", e.message);
    }

    if (q && q.trim()) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q.trim()}%` } },
        { email: { [Op.like]: `%${q.trim()}%` } },
      ];
    }

    const max = Math.min(Number(limit) || 2000, 5000);

    const rows = await User.findAll({
      where,
      attributes: ["id", "name", "email", "city", "country", "avatarUrl"],
      include: [
        { model: Profile, as: "profile", attributes: ["avatarUrl"], required: false },
      ],
      order: [["name", "ASC"]],
      limit: max,
    });

    const companies = rows.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      city: u.city || null,
      country: u.country || null,
      avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
    }));

    const response = { companies };

    try {
      await cache.set(__companiesCacheKey, response, USER_CACHE_TTL);
      console.log(`💾 Companies cached: ${__companiesCacheKey}`);
    } catch (e) {
      console.error("Companies cache write error:", e.message);
    }

    res.json(response);
  } catch (err) {
    next(err);
  }
};
