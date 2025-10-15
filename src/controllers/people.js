// src/controllers/people.controller.js
const { Op, Sequelize } = require("sequelize");
const {
  User,
  Profile,
  Category,
  Subcategory,
  Goal,
  UserCategory,
  Connection,
  ConnectionRequest,
  UserCategoryInterest,
  UserSubcategoryInterest,
  UserSubsubCategoryInterest,
  UserIdentityInterest,
  Identity,
  SubsubCategory,
  UserBlock,
  CompanyStaff,
} = require("../models");
const { cache } = require("../utils/redis");

function like(v) { return { [Op.like]: `%${v}%` }; }
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  return [val];
}

const PEOPLE_CACHE_TTL = 300;

function generatePeopleCacheKey(req) {
  const {
    q,
    country,
    accountType,
    city,
    categoryId,
    cats,
    subcategoryId,
    goalId,
    experienceLevel,
    connectionStatus,
    identityIds,
    audienceCategoryIds,
    audienceSubcategoryIds,
    audienceSubsubCategoryIds,
    viewOnlyConnections,
    industryIds,
    limit = 20,
    offset = 0,
  } = req.query;

  const currentUserId = req.user?.id || 'anonymous';

  const keyData = {
    q,
    country,
    accountType,
    city,
    categoryId,
    cats,
    subcategoryId,
    goalId,
    experienceLevel,
    connectionStatus,
    viewOnlyConnections,
    identityIds: ensureArray(identityIds),
    audienceCategoryIds: ensureArray(audienceCategoryIds),
    audienceSubcategoryIds: ensureArray(audienceSubcategoryIds),
    audienceSubsubCategoryIds: ensureArray(audienceSubsubCategoryIds),
    industryIds: ensureArray(industryIds),
    limit,
    offset,
    currentUserId,
  };

  Object.keys(keyData).forEach(k => {
    if (Array.isArray(keyData[k])) {
      keyData[k] = keyData[k].map(String).sort();
    }
  });

  return `people:${JSON.stringify(keyData)}`;
}

exports.searchPeople = async (req, res) => {
  try {
    const {
      q,
      country,
      accountType,
      city,
      categoryId,
      cats,
      subcategoryId,
      goalId,
      experienceLevel,
      connectionStatus,
      identityIds,
      audienceCategoryIds,
      audienceSubcategoryIds,
      audienceSubsubCategoryIds,
      viewOnlyConnections,
      industryIds,
      limit = 20,
      offset = 0,
    } = req.query;

    const lim = Number.isFinite(+limit) ? +limit : 20;
    const off = Number.isFinite(+offset) ? +offset : 0;
    const currentUserId = req.user?.id || null;

    // People cache: try read first
    let __peopleCacheKey = generatePeopleCacheKey(req);
    try {
      const cached = await cache.get(__peopleCacheKey);
      if (cached) {
        console.log(`✅ People cache hit for key: ${__peopleCacheKey}`);
        return res.json(cached);
      }
    } catch (e) {
      console.error("People cache read error:", e.message);
    }

    // Check if user has connectionsOnly enabled
    let connectionsOnly = false;
    let connectedUserIds = [];

    if (currentUserId) {
      try {
        const { UserSettings } = require("../models");
        const userSettings = await UserSettings.findOne({
          where: { userId: currentUserId },
          attributes: ['connectionsOnly']
        });
        connectionsOnly = userSettings?.connectionsOnly || viewOnlyConnections === 'true' || viewOnlyConnections === true;

        if (connectionsOnly) {
          // Get all connected user IDs (both directions)
          const connections = await Connection.findAll({
            where: {
              [Op.or]: [
                { userOneId: currentUserId },
                { userTwoId: currentUserId }
              ]
            },
            attributes: ['userOneId', 'userTwoId']
          });

          connectedUserIds = connections.flatMap(conn =>
            conn.userOneId === currentUserId ? [conn.userTwoId] : [conn.userOneId]
          );

          console.log(`Connections only filter enabled. Connected users: ${connectedUserIds.length}`);

           // If no connections, return empty result immediately
          if (connectedUserIds.length === 0) {
            const emptyResponse = { count: 0, items: [], sortedBy: "matchPercentage" };
            try {
              await cache.set(__peopleCacheKey, emptyResponse, PEOPLE_CACHE_TTL);
            } catch (e) {
              console.error("People cache write error:", e.message);
            }
            return res.json(emptyResponse);
          }


        }
      } catch (error) {
        console.error("Error loading user settings for connectionsOnly filter:", error);
      }
    }

    let myCategoryIds = [], mySubcategoryIds = [], myGoalIds = [];
    let myCountry = null, myCity = null;

    if (currentUserId) {
      const me = await User.findByPk(currentUserId, {
        attributes: ["id", "country", "city"],
        include: [
          { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] },
          { model: Goal, as: "goals", attributes: ["id"] },
        ],
      });
      if (me) {
        myCountry = me.country || null;
        myCity = me.city || null;
        myCategoryIds = (me.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
        mySubcategoryIds = (me.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);
        myGoalIds = (me.goals || []).map((g) => String(g.id)).filter(Boolean);
      }
    }

    const catsList = ensureArray(cats);
    const effCategoryIds = ensureArray(categoryId).concat(catsList).filter(Boolean);
    const effSubcategoryIds = ensureArray(subcategoryId).filter(Boolean);
    const effGoalIds = ensureArray(goalId).filter(Boolean);

    const effIdentityIds = ensureArray(identityIds).filter(Boolean);
    const effAudienceCategoryIds = ensureArray(audienceCategoryIds).filter(Boolean);
    const effAudienceSubcategoryIds = ensureArray(audienceSubcategoryIds).filter(Boolean);
    const effAudienceSubsubCategoryIds = ensureArray(audienceSubsubCategoryIds).filter(Boolean);
    const effIndustryIds = ensureArray(industryIds).filter(Boolean);

    // --- Blocklist exclusion (both directions) ---
    let excludeIds = [];
    if (currentUserId) {
      const [iBlock, theyBlock] = await Promise.all([
        UserBlock.findAll({ where: { blockerId: currentUserId }, attributes: ["blockedId"] }),
        UserBlock.findAll({ where: { blockedId: currentUserId }, attributes: ["blockerId"] }),
      ]);
      excludeIds = [
        ...new Set([
          ...iBlock.map((r) => String(r.blockedId)),
          ...theyBlock.map((r) => String(r.blockerId)),
        ]),
      ];
    }

    // =============== WHERE (User) =================
    const andClauses = [];
    const whereUser = {
      accountType: { [Op.ne]: "admin" },
      isVerified: true
    };
    if (currentUserId) whereUser.id = { [Op.notIn]: [String(currentUserId), ...excludeIds] };

    // Apply connectionsOnly filter if enabled
    if (connectionsOnly && connectedUserIds.length > 0) {
      whereUser.id = { [Op.in]: connectedUserIds };
    }

   

    if (accountType) {
      const types = ensureArray(accountType).map((t) => t.toLowerCase()).filter((t) => ["company", "individual"].includes(t));
      if (types.length) andClauses.push({ accountType: { [Op.in]: types } });
    }

    if (country && city) {
      andClauses.push({
        [Op.or]: [
          { country },
          { city: like(city) },
          { country: like(city) },
          { city: like(country) },
        ],
      });
    } else if (country) {
      andClauses.push({ [Op.or]: [{ country }, { city: like(country) }] });
    } else if (city) {
      andClauses.push({ [Op.or]: [{ city: like(city) }, { country: like(city) }] });
    }

    // --- q filter: user fields OR profile fields using $profile.field$ syntax ---
    if (q) {
      const qOr = [
        { name: like(q) },
        { email: like(q) },
        { phone: like(q) },
        { biography: like(q) },
        { nationality: like(q) },
        { country: like(q) },
        { city: like(q) },
        { countryOfResidence: like(q) },
        { "$profile.professionalTitle$": like(q) },
        { "$profile.about$": like(q) },
        { "$profile.primaryIdentity$": like(q) },
      ];
      andClauses.push({ [Op.or]: qOr });
    }

    if (andClauses.length) whereUser[Op.and] = andClauses;

    // =============== WHERE (Profile) ===============
    // Always require a non-empty professionalTitle
    // Require profile.professionalTitle OR profile.about to be non-empty
      const whereProfile = {
        [Op.or]: [
          {
            [Op.and]: [
              { professionalTitle: { [Op.ne]: null } },
              Sequelize.where(
                Sequelize.fn("char_length", Sequelize.fn("trim", Sequelize.col("profile.professionalTitle"))),
                { [Op.gt]: 0 }
              ),
            ],
          },
          {
            [Op.and]: [
              { about: { [Op.ne]: null } },
              Sequelize.where(
                Sequelize.fn("char_length", Sequelize.fn("trim", Sequelize.col("profile.about"))),
                { [Op.gt]: 0 }
              ),
            ],
          },
        ],
      };


    if (experienceLevel) {
      const levels = experienceLevel.split(",").filter(Boolean);
      if (levels.length) {
        whereProfile.experienceLevel = { [Op.in]: levels };
      }
    }

    const hasExplicitFilter = !!(
      effGoalIds.length ||
      effCategoryIds.length ||
      effSubcategoryIds.length ||
      effIdentityIds.length ||
      effAudienceCategoryIds.length ||
      effAudienceSubcategoryIds.length ||
      effAudienceSubsubCategoryIds.length ||
      effIndustryIds.length ||
      country || city || q || experienceLevel
    );

    // Profile should be required when filters that depend on profile data are used
    const profileRequired =  true

    // =============== Includes =====================
    // Interests include
    const interestsWhere = {};
    const allCategoryIds = [...new Set([...effCategoryIds, ...effAudienceCategoryIds])];
    const allSubcategoryIds = [...new Set([...effSubcategoryIds, ...effAudienceSubcategoryIds])];
    if (allCategoryIds.length) interestsWhere.categoryId = { [Op.in]: allCategoryIds };
    if (allSubcategoryIds.length) interestsWhere.subcategoryId = { [Op.in]: allSubcategoryIds };

    const interestsInclude = {
      model: UserCategory,
      as: "interests",
      required: !!(effCategoryIds.length || effSubcategoryIds.length),
      where: Object.keys(interestsWhere).length ? interestsWhere : undefined,
      include: [
        { model: Category, as: "category", required: false },
        { model: Subcategory, as: "subcategory", required: false },
      ],
    };

    // Goals include
    const goalsWhere = {};
    if (effGoalIds.length) goalsWhere.id = { [Op.in]: effGoalIds };
    const goalsInclude = {
      model: Goal,
      as: "goals",
      required: !!effGoalIds.length,
      where: Object.keys(goalsWhere).length ? goalsWhere : undefined,
      through: { attributes: [] },
    };

    const fetchLimit = lim * 3 + off;

    const rows = await User.findAll({
      where: whereUser,
      include: [
        // IMPORTANT: include profile as required when profile-dependent filters are used
        {
          model: Profile,
          as: "profile",
          required:  profileRequired,
          where: profileRequired ? whereProfile : undefined,
          attributes: ["id", "userId", "professionalTitle", "about", "primaryIdentity", "avatarUrl", "experienceLevel"],
        },
        interestsInclude,
        goalsInclude,
        // Include company staff relationships for approved staff members
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
        ...(effIdentityIds.length
          ? [{
              model: UserIdentityInterest,
              as: "identityInterests",
              required: true,
              where: { identityId: { [Op.in]: effIdentityIds } },
              include: [{ model: Identity, as: "identity" }],
            }]
          : []),
        ...(effAudienceCategoryIds.length
          ? [{
              model: UserCategoryInterest,
              as: "categoryInterests",
              required: true,
              where: { categoryId: { [Op.in]: effAudienceCategoryIds } },
              include: [{ model: Category, as: "category" }],
            }]
          : []),
        ...(effAudienceSubcategoryIds.length
          ? [{
              model: UserSubcategoryInterest,
              as: "subcategoryInterests",
              required: true,
              where: { subcategoryId: { [Op.in]: effAudienceSubcategoryIds } },
              include: [{ model: Subcategory, as: "subcategory" }],
            }]
          : []),
        ...(effAudienceSubsubCategoryIds.length
          ? [{
              model: UserSubsubCategoryInterest,
              as: "subsubCategoryInterests",
              required: true,
              where: { subsubCategoryId: { [Op.in]: effAudienceSubsubCategoryIds } },
              include: [{ model: SubsubCategory, as: "subsubCategory" }],
            }]
          : []),
        ...(effIndustryIds.length
          ? [{
              model: require("../models").UserIndustryCategory,
              as: "industryCategories",
              required: true,
              where: { industryCategoryId: { [Op.in]: effIndustryIds } },
              include: [{ model: require("../models").IndustryCategory, as: "industryCategory" }],
            }]
          : []),
      ],
      order: [["createdAt", "DESC"]],
      limit: fetchLimit,
      subQuery: false,     // <-- required for $profile.*$ in WHERE
      distinct: true,
    });

    // =============== Connection status sets ===============
    const filterStatusesArr = ensureArray(connectionStatus).map((s) => s.toLowerCase());
    let connectedSet = new Set(), outgoingPendingSet = new Set(), incomingPendingSet = new Set();

    if (currentUserId) {
      const cons = await Connection.findAll({
        where: { [Op.or]: [{ userOneId: currentUserId }, { userTwoId: currentUserId }] },
        attributes: ["userOneId", "userTwoId"],
      });
      cons.forEach((c) => {
        const other = String(c.userOneId) === String(currentUserId) ? String(c.userTwoId) : String(c.userOneId);
        connectedSet.add(other);
      });

      const [outgoingReqs, incomingReqs] = await Promise.all([
        ConnectionRequest.findAll({ where: { fromUserId: currentUserId, status: "pending" }, attributes: ["toUserId"] }),
        ConnectionRequest.findAll({ where: { toUserId: currentUserId, status: "pending" }, attributes: ["fromUserId"] }),
      ]);
      outgoingPendingSet = new Set(outgoingReqs.map((r) => String(r.toUserId)));
      incomingPendingSet = new Set(incomingReqs.map((r) => String(r.fromUserId)));
    }


    // =============== Match % ===============
    const calculateMatchPercentage = (u) => {
      if (!currentUserId) {
        // When no current user, calculate based on applied filters
        const WEIGHTS = { category: 20, subcategory: 20, goal: 15, identity: 10, industry: 10, location: 15, text: 10, experienceLevel: 10 };
        let totalScore = 0, matchedFactors = 0;

        // Category matching
        if (effCategoryIds.length) {
          const userCats = (u.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
          const catMatches = userCats.filter((id) => effCategoryIds.includes(id));
          if (catMatches.length) {
            const pct = Math.min(1, catMatches.length / effCategoryIds.length);
            totalScore += WEIGHTS.category * pct; matchedFactors++;
          }
        }

        // Subcategory matching
        if (effSubcategoryIds.length) {
          const userSubs = (u.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);
          const subMatches = userSubs.filter((id) => effSubcategoryIds.includes(id));
          if (subMatches.length) {
            const pct = Math.min(1, subMatches.length / effSubcategoryIds.length);
            totalScore += WEIGHTS.subcategory * pct; matchedFactors++;
          }
        }

        // Goal matching
        if (effGoalIds.length) {
          const userGoalIds = (u.goals || []).map((g) => String(g.id));
          const goalMatches = userGoalIds.filter((id) => effGoalIds.includes(id));
          if (goalMatches.length) {
            const pct = Math.min(1, goalMatches.length / effGoalIds.length);
            totalScore += WEIGHTS.goal * pct; matchedFactors++;
          }
        }

        // Identity matching
        if (effIdentityIds.length) {
          const userIdentityIds = (u.identityInterests || []).map((i) => String(i.identityId)).filter(Boolean);
          const identityMatches = userIdentityIds.filter((id) => effIdentityIds.includes(id));
          if (identityMatches.length) {
            const pct = Math.min(1, identityMatches.length / effIdentityIds.length);
            totalScore += WEIGHTS.identity * pct; matchedFactors++;
          }
        }

        // Industry matching
        if (effIndustryIds.length) {
          const userIndustryIds = (u.industryCategories || []).map((i) => String(i.industryCategoryId)).filter(Boolean);
          const industryMatches = userIndustryIds.filter((id) => effIndustryIds.includes(id));
          if (industryMatches.length) {
            const pct = Math.min(1, industryMatches.length / effIndustryIds.length);
            totalScore += WEIGHTS.industry * pct; matchedFactors++;
          }
        }

        // Location matching based on filters
        let locationScore = 0;
        if (country && u.country && String(country) === String(u.country)) locationScore += 0.6;
        if (city && u.city) {
          const a = String(city).toLowerCase(), b = String(u.city).toLowerCase();
          if (a === b) locationScore += 0.4; else if (a.includes(b) || b.includes(a)) locationScore += 0.2;
        }
        if (locationScore) { totalScore += WEIGHTS.location * locationScore; matchedFactors++; }

        // Text matching for q filter
        if (q) {
          const qLower = q.toLowerCase();
          let textMatches = 0;
          const textFields = [
            u.name, u.email, u.phone, u.biography, u.nationality, u.country, u.city,
            u.countryOfResidence, u.profile?.professionalTitle, u.profile?.about, u.profile?.primaryIdentity
          ].filter(Boolean);

          textFields.forEach(field => {
            if (String(field).toLowerCase().includes(qLower)) textMatches++;
          });

          if (textMatches > 0) {
            const textScore = Math.min(1, textMatches / textFields.length);
            totalScore += WEIGHTS.text * textScore;
            matchedFactors++;
          }
        }

        // Experience level matching
        if (experienceLevel) {
          const filteredLevels = experienceLevel.split(",").filter(Boolean);
          if (filteredLevels.includes(u.profile?.experienceLevel)) {
            totalScore += WEIGHTS.experienceLevel;
            matchedFactors++;
          }
        }

        return Math.max(0, Math.min(100, Math.round(totalScore)));
      }

      // Original logic for logged-in users
      const userGoalIds = (u.goals || []).map((g) => String(g.id));
      const userCats = (u.interests || []).map((i) => String(i.categoryId)).filter(Boolean);
      const userSubs = (u.interests || []).map((i) => String(i.subcategoryId)).filter(Boolean);

      const REQUIRED_FACTORS = 3;
      const WEIGHTS = { category: 30, subcategory: 35, goal: 25, location: 10 };
      let totalScore = 0, matchedFactors = 0;

      const allMyCategoryIds = [...new Set([...myCategoryIds, ...effAudienceCategoryIds])];
      if (allMyCategoryIds.length && userCats.length) {
        const catMatches = userCats.filter((id) => allMyCategoryIds.includes(id));
        if (catMatches.length) {
          const pct = Math.min(1, catMatches.length / Math.max(myCategoryIds.length, userCats.length));
          totalScore += WEIGHTS.category * pct; matchedFactors++;
        }
      }

      const allMySubcategoryIds = [...new Set([...mySubcategoryIds, ...effAudienceSubcategoryIds])];
      if (allMySubcategoryIds.length && userSubs.length) {
        const subMatches = userSubs.filter((id) => allMySubcategoryIds.includes(id));
        if (subMatches.length) {
          const pct = Math.min(1, subMatches.length / Math.max(mySubcategoryIds.length, userSubs.length));
          totalScore += WEIGHTS.subcategory * pct; matchedFactors++;
        }
      }

      const myGoalSet = new Set(myGoalIds);
      const goalMatches = userGoalIds.filter((id) => myGoalSet.has(id)).length;
      if (goalMatches) { totalScore += WEIGHTS.goal * Math.min(1, goalMatches / Math.max(myGoalIds.length, userGoalIds.length)); matchedFactors++; }

      let locationScore = 0;
      if (myCountry && u.country && String(myCountry) === String(u.country)) locationScore += 0.6;
      if (myCity && u.city) {
        const a = String(myCity).toLowerCase(), b = String(u.city).toLowerCase();
        if (a === b) locationScore += 0.4; else if (a.includes(b) || b.includes(a)) locationScore += 0.2;
      }
      if (locationScore) { totalScore += WEIGHTS.location * locationScore; matchedFactors++; }

      if (matchedFactors < REQUIRED_FACTORS) totalScore *= Math.max(0.3, matchedFactors / REQUIRED_FACTORS);
       return Math.max(0, Math.min(100, Math.round(totalScore)));
      };

      let items = rows.map((u) => {
      const matchPercentage = calculateMatchPercentage(u);
      let cStatus = "none";
      if (currentUserId) {
        const uid = String(u.id);
        if (connectedSet.has(uid)) cStatus = "connected";
        else if (outgoingPendingSet.has(uid)) cStatus = "outgoing_pending";
        else if (incomingPendingSet.has(uid)) cStatus = "incoming_pending";
      }

      const goalNames = (u.goals || []).map((g) => g.name).filter(Boolean);
      const catsOut = (u.interests || []).map((i) => i.category?.name).filter(Boolean);
      const subsOut = (u.interests || []).map((i) => i.subcategory?.name).filter(Boolean);

      return {
        raw: u,
        score: 0,
        out: {
          id: u.id,
          name: u.name,
          role: u.profile?.professionalTitle || null,
          city: u.city || null,
          country: u.country || null,
          countryOfResidence: u.countryOfResidence,
          avatarUrl: u.profile?.avatarUrl || u.avatarUrl || null,
          email: u.email,
          lookingFor: goalNames.join(", "),
          goals: goalNames,
          cats: catsOut,
          subcats: subsOut,
          about: u.profile?.about || null,
          createdAt: u.createdAt,
          connectionStatus: cStatus,
          accountType: u.accountType,
          matchPercentage,

          // Company information for approved staff members
          companyMemberships: u.staffOf?.map(staff => ({
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
        },
      };
    });

    // Sort by matchPercentage then recency
    items.sort((a, b) => {
      if (a.out.matchPercentage !== b.out.matchPercentage) return b.out.matchPercentage - a.out.matchPercentage;
      return new Date(b.raw.createdAt) - new Date(a.raw.createdAt);
    });

    // Optional connection status filter
    if (ensureArray(connectionStatus).length) {
      const allow = new Set(ensureArray(connectionStatus).map((s) => s.toLowerCase()));
      items = items.filter((x) => allow.has(x.out.connectionStatus));
    }

    const windowed = items.slice(off, off + lim).map((x) => x.out);
    const response = { count: items.length, items: windowed, sortedBy: "matchPercentage" };
    try {
      await cache.set(__peopleCacheKey, response, PEOPLE_CACHE_TTL);
      console.log(`💾 People cached: ${__peopleCacheKey}`);
    } catch (e) {
      console.error("People cache write error:", e.message);
    }
    return res.json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Failed to search people" });
  }
};