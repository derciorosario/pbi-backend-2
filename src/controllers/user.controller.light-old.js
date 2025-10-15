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
const { getBlockStatus } = require("../utils/blocking");

const normalizePair = (id1, id2) => {
  const a = String(id1);
  const b = String(id2);
  return a < b ? [a, b] : [b, a];
};


const stripDataUrl = (s) => (s && String(s).startsWith("data:") ? null : s);

const toPublicUser = (u) => ({
  id: u.id,
  name: u.name,
  title: u.profile?.professionalTitle || null,
  city: u.city || null,
  country: u.country || null,
  avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
  //avatarUrl: stripDataUrl(u?.profile?.avatarUrl || u?.avatarUrl) || null,
});




























exports.getPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.id || null;

    // 1) Fetch the user with LEAN includes only (no large arrays/blobs)
    const user = await User.findByPk(id, {
      attributes: ["id", "name", "email", "accountType", "country", "city", "avatarUrl", "createdAt"],
      include: [
        {
          model: Profile,
          as: "profile",
          attributes: [
            "id",
            "avatarUrl",
            "professionalTitle",
            "about",
            "experienceLevel",
            "skills",
            "languages",
            "primaryIdentity",
          ],
          required: false,
        },

        // BelongsToMany — names only, no join-table attrs
        { model: Goal,        as: "goals",           attributes: ["id", "name"], through: { attributes: [] }, required: false },
        { model: Identity,    as: "identities",      attributes: ["id", "name"], through: { attributes: [] }, required: false },
        { model: Category,    as: "categories",      attributes: ["id", "name"], through: { attributes: [] }, required: false },
        { model: Subcategory, as: "subcategories",   attributes: ["id", "name"], through: { attributes: [] }, required: false },
        { model: SubsubCategory, as: "subsubcategories", attributes: ["id", "name"], through: { attributes: [] }, required: false },

        // Interests — only ids+names, LEFT joins (required:false)
        {
          model: UserIdentityInterest,
          as: "identityInterests",
          attributes: ["id"],
          include: [{ model: Identity, as: "identity", attributes: ["id", "name"], required: false }],
          required: false,
        },
        {
          model: UserCategoryInterest,
          as: "categoryInterests",
          attributes: ["id"],
          include: [{ model: Category, as: "category", attributes: ["id", "name"], required: false }],
          required: false,
        },
        {
          model: UserSubcategoryInterest,
          as: "subcategoryInterests",
          attributes: ["id"],
          include: [{ model: Subcategory, as: "subcategory", attributes: ["id", "name"], required: false }],
          required: false,
        },
        {
          // ⚠️ Alias MUST match your association: 'subsubInterests'
          model: UserSubsubCategoryInterest,
          as: "subsubInterests",
          attributes: ["id"],
          include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id", "name"], required: false }],
          required: false,
        },

        // Company staff memberships (lean)
        {
          model: CompanyStaff,
          as: "staffOf",               // matches User.hasMany(CompanyStaff, { as: 'staffOf', foreignKey: 'staffId' })
          where: { status: "confirmed" },
          required: false,
          attributes: ["id", "companyId", "role", "isMain", "confirmedAt"],
          include: [
            {
              model: User,
              as: "company",
              attributes: ["id", "name", "avatarUrl", "city", "country"],
              include: [
                { model: Profile, as: "profile", attributes: ["avatarUrl", "professionalTitle"], required: false },
              ],
              required: false,
            },
          ],
        },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.accountType === "admin") return res.status(404).json({ message: "User not found" });

    // 2) Work samples — separate small query (NO base64)
    const workSamples = [] /*await WorkSample.findAll({
      where: {
        profileId: user.profile?.id || null,
        ...(viewerId && String(viewerId) === String(id) ? {} : { isPublic: true }),
      },
      attributes: [
        "id",
        "title",
        "description",
        "projectUrl",
        // DO NOT include imageBase64 here
        "imageFileName",
        "category",
        "technologies",
        "completionDate",
        "isPublic",
        "createdAt",
        "updatedAt",
      ],
      order: [["createdAt", "DESC"]],
      limit: 12, // keep small; paginate if needed
    });*/

    // 3) Cheap counts
    const [jobsCount, eventsCount, servicesCount, productsCount, tourismCount, fundingCount] = await Promise.all([
      Job.count({ where: { postedByUserId: user.id } }),
      Event.count({ where: { organizerUserId: user.id } }),
      Service.count({ where: { providerUserId: user.id } }),
      Product.count({ where: { sellerUserId: user.id } }),
      Tourism.count({ where: { authorUserId: user.id } }),
      Funding.count({ where: { creatorUserId: user.id } }),
    ]);

    // 4) Recent items (bounded + attributes only)
    const [recentJobs, recentEvents, recentServices, recentProducts, recentFunding] = await Promise.all([
      Job.findAll({
        where: { postedByUserId: user.id },
        attributes: ["id", "title", "companyName", "city", "country", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 3,
      }),
      Event.findAll({
        where: { organizerUserId: user.id },
        attributes: ["id", "title", "city", "country", "startAt", "createdAt", "registrationType", "price", "currency"],
        order: [["createdAt", "DESC"]],
        limit: 3,
      }),
      Service.findAll({
        where: { providerUserId: user.id },
        attributes: ["id", "title", "priceAmount", "priceType", "deliveryTime", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 3,
      }),
      Product.findAll({
        where: { sellerUserId: user.id },
        attributes: ["id", "title", "price", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 3,
      }),
      Funding.findAll({
        where: { creatorUserId: user.id },
        attributes: ["id", "title", "goal", "raised", "currency", "deadline", "createdAt"],
        order: [["createdAt", "DESC"]],
        limit: 3,
      }),
    ]);

    // 5) Connections + viewer connection status
    const connections = await Connection.count({
      where: { [Op.or]: [{ userOneId: user.id }, { userTwoId: user.id }] },
    });

    let connectionStatus = "none";
    if (viewerId && String(viewerId) !== String(user.id)) {
      const [a, b] = normalizePair(viewerId, user.id);
      const [accepted, outgoingReq, incomingReq] = await Promise.all([
        Connection.findOne({ where: { userOneId: a, userTwoId: b }, attributes: ["id"] }),
        ConnectionRequest.findOne({ where: { status: "pending", fromUserId: viewerId, toUserId: user.id }, attributes: ["id"] }),
        ConnectionRequest.findOne({ where: { status: "pending", fromUserId: user.id, toUserId: viewerId }, attributes: ["id"] }),
      ]);
      if (accepted) connectionStatus = "connected";
      else if (outgoingReq) connectionStatus = "outgoing_pending";
      else if (incomingReq) connectionStatus = "incoming_pending";
    } else if (viewerId && String(viewerId) === String(user.id)) {
      connectionStatus = "self";
    }

    // 6) Meetings (bounded, lean includes)
    let meetings = [];
    if (viewerId && String(viewerId) !== String(user.id)) {
      meetings = await MeetingRequest.findAll({
        where: {
          [Op.or]: [
            { fromUserId: user.id,   toUserId: viewerId },
            { fromUserId: viewerId,  toUserId: user.id  },
          ],
        },
        attributes: [
          "id", "title", "agenda", "scheduledAt", "duration", "timezone",
          "mode", "location", "link", "status", "createdAt",
        ],
        order: [["scheduledAt", "DESC"]],
        limit: 5,
        include: [
          { model: User, as: "requester", attributes: ["id", "name", "avatarUrl", "city", "country"],
            include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"], required: false }], required: false },
          { model: User, as: "recipient", attributes: ["id", "name", "avatarUrl", "city", "country"],
            include: [{ model: Profile, as: "profile", attributes: ["professionalTitle"], required: false }], required: false },
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

    // 7) Account-type specific extras
    let accountDetails = {};
    if (user.accountType === "individual") {
      accountDetails = {
        type: "individual",
        professionalTitle: user.profile?.professionalTitle || null,
        experienceLevel: user.profile?.experienceLevel || null,
      };
    } else if (user.accountType === "company") {
      accountDetails = {
        type: "company",
        professionalTitle: user.profile?.professionalTitle || null,
        experienceLevel: user.profile?.experienceLevel || null,
        categories: user.categories?.map(c => c.name) || [],
      };
    }

    // 8) Block status
    const block = await getBlockStatus(viewerId, user.id);

    // 9) Final payload (no base64 images)
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email, // hide if needed for non-owners
      accountType: user.accountType,
      city: user.city,
      country: user.country,
      avatarUrl: user.profile?.avatarUrl || user.avatarUrl,
      professionalTitle: user.profile?.professionalTitle || null,
      about: user.profile?.about || null,
      experienceLevel: user.profile?.experienceLevel || null,
      skills: Array.isArray(user.profile?.skills) ? user.profile.skills : (user.profile?.skills || []),
      languages: Array.isArray(user.profile?.languages) ? user.profile.languages : (user.profile?.languages || []),
      primaryIdentity: user.profile?.primaryIdentity || null,
      memberSince: user.createdAt,

      workSamples: workSamples.map(ws => ({
        id: ws.id,
        title: ws.title,
        description: ws.description,
        projectUrl: ws.projectUrl,
        imageFileName: ws.imageFileName, // no base64 here
        category: ws.category,
        technologies: Array.isArray(ws.technologies) ? ws.technologies : [],
        completionDate: ws.completionDate,
        isPublic: !!ws.isPublic,
        createdAt: ws.createdAt,
      })),

      companyMemberships:
        (user.staffOf || []).map(staff => ({
          id: staff.id,
          companyId: staff.companyId,
          role: staff.role,
          isMain: staff.isMain,
          joinedAt: staff.confirmedAt,
          company: toPublicUser(staff.company),
        })),

      // Canonical selections
      identities: (user.identities || []).map(i => i.name),
      categories: (user.categories || []).map(c => c.name),
      subcategories: (user.subcategories || []).map(s => s.name),
      subsubs: (user.subsubcategories || []).map(s3 => s3.name),

      // Interests (looking for)
      interests: {
        identities: (user.identityInterests || []).map(ii => ii.identity?.name).filter(Boolean),
        categories: (user.categoryInterests || []).map(ci => ci.category?.name).filter(Boolean),
        subcategories: (user.subcategoryInterests || []).map(si => si.subcategory?.name).filter(Boolean),
        subsubs: (user.subsubInterests || []).map(ssi => ssi.subsubCategory?.name).filter(Boolean),
      },

      goals: (user.goals || []).map(g => g.name),

      // Activity stats & recent
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

    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch profile" });
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

    res.json({ companies });
  } catch (err) {
    next(err);
  }
};
