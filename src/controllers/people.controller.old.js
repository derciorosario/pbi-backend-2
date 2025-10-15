// src/controllers/people.controller.js
const { Op, Sequelize } = require("sequelize");
const {
  User,
  Profile,
  Category,
  Subcategory,
  Goal,
  UserCategory,
  UserSubcategory,
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
  IndustryCategory,
} = require("../models");

const { UserSettings } = require("../models");
const { cache } = require("../utils/redis");
const { getIdentityCatalogFunc } = require("../utils/identity_taxonomy");

function like(v) { return { [Op.like]: `%${v}%` }; }
function ensureArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") return val.split(",").map((s) => s.trim()).filter(Boolean);
  return [val];
}

function calculateBidirectionalMatch(aToB, bToA) {
   const average = (aToB + bToA) / 2;
   return average;
 }

function calculateReciprocalWeightedMatch(aToB, bToA, weightSelf = 0.7) {
   const weightOther = 1 - weightSelf;

   // User A's perceived match score
   const userAPerceived = (aToB * weightSelf) + (bToA * weightOther);

   return userAPerceived;
 }

const PEOPLE_CACHE_TTL = 300;

let identityCatalog;

(async () => {
  identityCatalog = await getIdentityCatalogFunc('all');
})();




// Add the checkIfBelongs function at the top of your file
function checkIfBelongs(type, itemId, identityIds) {
  if (!identityIds || identityIds.length === 0 || !itemId) {
    return false;
  }

  const searchId = String(itemId);

  for (const identity of identityCatalog) {
    if (!identityIds.includes(String(identity.id))) {
      continue;
    }

    if (identity.categories) {
      for (const category of identity.categories) {
        if (type === 'category' && String(category.id) === searchId) {
          return true;
        }

        if (category.subcategories) {
          for (const subcategory of category.subcategories) {
            if (type === 'subcategory' && String(subcategory.id) === searchId) {
              return true;
            }

            if (subcategory.subsubs) {
              for (const subsub of subcategory.subsubs) {
                if (type === 'subsubcategory' && String(subsub.id) === searchId) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }

  return false;
}


function generatePeopleCacheKey(req, bidirectionalMatch = true, bidirectionalMatchFormula = "reciprocal") {
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
     industryIds,
     viewOnlyConnections,
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
    bidirectionalMatch,
    bidirectionalMatchFormula,
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
        bidirectionalMatch,
        bidirectionalMatchFormula,
        limit = 20,
        offset = 0,
      } = req.query;

      // Set default values for matching configuration
      let userBidirectionalMatch = bidirectionalMatch !== undefined ? bidirectionalMatch : true;
      let userBidirectionalMatchFormula = bidirectionalMatchFormula || "reciprocal";

    

    const lim = Number.isFinite(+limit) ? +limit : 20;
    const off = Number.isFinite(+offset) ? +offset : 0;
    const currentUserId = req.user?.id || null;

    // Load user settings for matching configuration if not provided in query and user is logged in
    if (currentUserId && (bidirectionalMatch === undefined || bidirectionalMatchFormula === undefined)) {
      try {
        const { UserSettings } = require("../models");
        const userSettings = await UserSettings.findOne({
          where: { userId: currentUserId },
          attributes: ['bidirectionalMatch', 'bidirectionalMatchFormula']
        });

        if (userSettings) {
          if (bidirectionalMatch === undefined) {
            userBidirectionalMatch = userSettings.bidirectionalMatch;
          }
          if (bidirectionalMatchFormula === undefined) {
            userBidirectionalMatchFormula = userSettings.bidirectionalMatchFormula;
          }
        }
      } catch (error) {
        console.error("Error loading user settings for matching configuration:", error);
        // Use defaults if there's an error - already set above
      }
    }

    // People cache: try read first
    let __peopleCacheKey = generatePeopleCacheKey(req, userBidirectionalMatch === 'true' || userBidirectionalMatch === true, userBidirectionalMatchFormula);
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

    let myCategoryIds = [], mySubcategoryIds = [], mySubsubCategoryIds = [], myGoalIds = [];
    let myCountry = null, myCity = null;
    let myIdentities = [], myIdentityInterests = [], myCategoryInterests = [], mySubcategoryInterests = [], mySubsubCategoryInterests = [];

    if (currentUserId) {
      const me = await User.findByPk(currentUserId, {
        attributes: ["id", "country", "city"],
        include: [
          { 
            model: require("../models").UserSubcategory, 
            as: "userSubcategories", 
            attributes: ["subcategoryId"],
            include: [{ model: Subcategory, as: "subcategory", attributes: ["id"] }]
          },
          { model: UserCategory, as: "interests", attributes: ["categoryId", "subcategoryId"] },
          { model: Goal, as: "goals", attributes: ["id"] },
          { model: require("../models").Identity, as: "identities", attributes: ["id"], through: { attributes: [] } },
          { model: UserIdentityInterest, as: "identityInterests", attributes: ["identityId"], include: [{ model: require("../models").Identity, as: "identity", attributes: ["id"] }] },
          { model: UserCategoryInterest, as: "categoryInterests", attributes: ["categoryId"], include: [{ model: Category, as: "category", attributes: ["id"] }] },
          { model: UserSubcategoryInterest, as: "subcategoryInterests", attributes: ["subcategoryId"], include: [{ model: Subcategory, as: "subcategory", attributes: ["id"] }] },
          { model: UserSubsubCategoryInterest, as: "subsubInterests", attributes: ["subsubCategoryId"], include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id"] }] },
          // Also load what the current user offers (subsubcategories)
          { model: require("../models").UserSubsubCategory, as: "userSubsubCategories", attributes: ["subsubCategoryId"], include: [{ model: SubsubCategory, as: "subsubCategory", attributes: ["id"] }] },
        ],
      });
      if (me) {
        myCountry = me.country || null;
        myCity = me.city || null;
        myCategoryIds = (me.interests || []).map((i) => String(i.categoryId)).filter(id => id && id !== 'null');
       // mySubcategoryIds = (me.interests || []).map((i) => String(i.subcategoryId)).filter(id => id && id !== 'null');
        mySubcategoryIds = (me.userSubcategories || []).map((i) => String(i.subcategoryId)).filter(id => id && id !== 'null');
        mySubsubCategoryIds = (me.userSubsubCategories || []).map((i) => String(i.subsubCategoryId)).filter(id => id && id !== 'null');
        myGoalIds = (me.goals || []).map((g) => String(g.id)).filter(Boolean);

        // Load current user's "does" and "looking for" data
        myIdentities = (me.identities || []).map(i => i);
        myIdentityInterests = (me.identityInterests || []).map(i => i);
        myCategoryInterests = (me.categoryInterests || []).map(i => i);
        mySubcategoryInterests = (me.subcategoryInterests || []).map(i => i);
        mySubsubCategoryInterests = (me.subsubInterests || []).map(i => i);

        // Debug logging
        console.log('Current user identity interests:', myIdentityInterests.map(i => i.identityId));
        console.log('Current user identities:', myIdentities.map(i => i.id));
        console.log('Current user category interests:', myCategoryInterests.map(i => i.categoryId));
        console.log('Current user subcategory interests:', mySubcategoryInterests.map(i => i.subcategoryId));
        console.log('Current user subsubcategory interests:', mySubsubCategoryInterests.map(i => i.subsubCategoryId));
        console.log('Raw subsubInterests from database:', me.subsubInterests);

      }

      // Fix: Handle subsubcategory interests properly
      // If user has explicit subsubcategory interests, use them directly
      if (mySubsubCategoryInterests.length > 0) {
        console.log(`User has explicit subsubcategory interests: ${mySubsubCategoryInterests.map(i => i.subsubCategoryId)}`);
      } else if (mySubcategoryInterests.length > 0) {
        console.log('User has subcategory interests but no explicit subsubcategory interests - inferring subsubcategories...');

        // Get the subcategories the user has interests in
        const interestedSubcategoryIds = mySubcategoryInterests.map(i => i.subcategoryId);

        // Get the subsubcategories the user is actually associated with (what they offer)
        const userSubsubCategoryIds = mySubsubCategoryIds;

        if (userSubsubCategoryIds.length > 0) {
          console.log(`User's actual subsubcategory associations: ${userSubsubCategoryIds.length} IDs`);

          // First, validate that these IDs actually exist in the database
          const validSubsubCategories = await SubsubCategory.findAll({
            where: {
              id: { [Op.in]: userSubsubCategoryIds }
            },
            attributes: ['id', 'subcategoryId']
          });

          console.log(`Found ${validSubsubCategories.length} valid subsubcategories in database`);

          if (validSubsubCategories.length > 0) {
            // Filter to only include subsubcategories that belong to the user's subcategory interests
            const validSubsubWithMatchingSubcategories = validSubsubCategories.filter(ss =>
              interestedSubcategoryIds.includes(ss.subcategoryId)
            );

            console.log(`Found ${validSubsubWithMatchingSubcategories.length} subsubcategories that match user's subcategory interests`);

            if (validSubsubWithMatchingSubcategories.length > 0) {
              // Create inferred subsubcategory interests from the validated intersection
              const inferredSubsubInterests = validSubsubWithMatchingSubcategories.map(ss => ({
                subsubCategoryId: ss.id,
                subsubCategory: ss
              }));

              mySubsubCategoryInterests = inferredSubsubInterests;
              console.log(`Inferred ${inferredSubsubInterests.length} subsubcategory interests from subcategory interests`);
              console.log(`Inferred subsubcategory IDs: ${inferredSubsubInterests.map(i => i.subsubCategoryId)}`);
            } else {
              console.log('No subsubcategories found that match both user interests and actual associations');
            }
          } else {
            console.log('No valid subsubcategories found in database for user associations');
          }
        } else {
          console.log('User has no subsubcategory associations to infer from');
        }
      } else {
        console.log('User has no subcategory or subsubcategory interests');
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
        { "$staffOf.company.name$": like(q) },
        { "$staffOf.company.profile.about$": like(q) },
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

    const subcategoriesInclude = {
      model: UserSubcategory,
      as: "userSubcategories",
      required: false,
      include: [
        { model: Subcategory, as: "subcategory", required: false },
      ],
    };

    const subsubcategoriesInclude = {
      model: require("../models").UserSubsubCategory,
      as: "userSubsubCategories",
      required: false,
      include: [
        { model: SubsubCategory, as: "subsubCategory", required: false },
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

    console.log('=== PEOPLE SEARCH DEBUG - DATABASE QUERY ===');
    console.log('Query parameters:', {
      fetchLimit,
      profileRequired,
      connectionsOnly,
      connectedUserIds: connectedUserIds.length,
      excludeIds: excludeIds.length,
      effCategoryIds: effCategoryIds.length,
      effSubcategoryIds: effSubcategoryIds.length,
      effGoalIds: effGoalIds.length,
      effIdentityIds: effIdentityIds.length,
      effAudienceCategoryIds: effAudienceCategoryIds.length,
      effAudienceSubcategoryIds: effAudienceSubcategoryIds.length,
      effAudienceSubsubCategoryIds: effAudienceSubsubCategoryIds.length,
      effIndustryIds: effIndustryIds.length
    });


    

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
              include: [{ model: Profile, as: "profile", attributes: ["avatarUrl", "about", "professionalTitle"], required: false }]
            }
          ]
        },
          
      ],
      order: [["createdAt", "DESC"]],
      limit: fetchLimit,
      subQuery: false,     // <-- required for $profile.*$ in WHERE
      distinct: true,
    });


/**    const rows = await User.findAll({
  where: whereUser,
  include: [
    {
      model: Profile,
      as: "profile",
      required: profileRequired,
      where: profileRequired ? whereProfile : undefined,
      attributes: ["id", "userId", "professionalTitle", "about", "primaryIdentity", "avatarUrl", "experienceLevel"],
    },
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
    }
  ],
  order: [["createdAt", "DESC"]],
  limit: fetchLimit,
}); */

// Now fetch additional associations for each user separately
/*const userIds = rows.map(user => user.id);

// Fetch all associations in parallel - INCLUDING THE MISSING ONES
const [
  userInterests,           // This covers interestsInclude
  userSubcategories,       // This covers subcategoriesInclude  
  userSubsubCategories,    // This covers subsubcategoriesInclude
  userGoals,               // This covers goalsInclude
  userIdentityInterests,
  userCategoryInterests,
  userSubcategoryInterests,
  userSubsubInterests,
  userIdentities
] = await Promise.all([
  // UserCategory interests (interestsInclude)
  UserCategory.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(Object.keys(interestsWhere).length ? interestsWhere : {})
    },
    include: [
      { model: Category, as: "category", required: false },
      { model: Subcategory, as: "subcategory", required: false },
    ],
  }),
  
  // UserSubcategories (subcategoriesInclude)
  require("../models").UserSubcategory.findAll({
    where: { userId: { [Op.in]: userIds } },
    include: [{ model: Subcategory, as: "subcategory", required: false }],
  }),
  
  // UserSubsubCategories (subsubcategoriesInclude)
  require("../models").UserSubsubCategory.findAll({
    where: { userId: { [Op.in]: userIds } },
    include: [{ model: SubsubCategory, as: "subsubCategory", required: false }],
  }),
  
  // Goals (goalsInclude)
  User.findAll({
    where: { 
      id: { [Op.in]: userIds },
      ...(effGoalIds.length ? {
        '$goals.id$': { [Op.in]: effGoalIds }
      } : {})
    },
    include: [{
      model: Goal,
      as: "goals",
      required: false,
      through: { attributes: [] },
    }],
    attributes: ['id']
  }),
  
  // Identity Interests
  UserIdentityInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effIdentityIds.length ? { identityId: { [Op.in]: effIdentityIds } } : {})
    },
    include: [{ model: Identity, as: "identity" }],
  }),
  
  // Category Interests
  UserCategoryInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effAudienceCategoryIds.length ? { categoryId: { [Op.in]: effAudienceCategoryIds } } : {})
    },
    include: [{ model: Category, as: "category" }],
  }),
  
  // Subcategory Interests
  UserSubcategoryInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effAudienceSubcategoryIds.length ? { subcategoryId: { [Op.in]: effAudienceSubcategoryIds } } : {})
    },
    include: [{ model: Subcategory, as: "subcategory" }],
  }),
  
  // SubsubCategory Interests
  UserSubsubCategoryInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effAudienceSubsubCategoryIds.length ? { subsubCategoryId: { [Op.in]: effAudienceSubsubCategoryIds } } : {})
    },
    include: [{ model: SubsubCategory, as: "subsubCategory" }],
  }),
  
  // User Identities
  User.findAll({
    where: { id: { [Op.in]: userIds } },
    include: [{
      model: Identity,
      as: "identities",
      required: false,
      through: { attributes: [] },
    }],
    attributes: ['id']
  })
]);

// Group associations by userId for easy lookup
const associationsByUserId = {};

userIds.forEach(userId => {
  associationsByUserId[userId] = {
    interests: userInterests.filter(interest => String(interest.userId) === String(userId)),
    userSubcategories: userSubcategories.filter(sub => String(sub.userId) === String(userId)),
    userSubsubCategories: userSubsubCategories.filter(sub => String(sub.userId) === String(userId)),
    goals: userGoals.find(user => String(user.id) === String(userId))?.goals || [],
    identityInterests: userIdentityInterests.filter(interest => String(interest.userId) === String(userId)),
    categoryInterests: userCategoryInterests.filter(interest => String(interest.userId) === String(userId)),
    subcategoryInterests: userSubcategoryInterests.filter(interest => String(interest.userId) === String(userId)),
    subsubInterests: userSubsubInterests.filter(interest => String(interest.userId) === String(userId)),
    identities: userIdentities.find(user => String(user.id) === String(userId))?.identities || [],
  };
});

// Attach associations to each user object
rows.forEach(user => {
  const userId = String(user.id);
  const associations = associationsByUserId[userId] || {};
  
  // These correspond to your original includes:
  user.interests = associations.interests || [];                    // interestsInclude
  user.userSubcategories = associations.userSubcategories || [];   // subcategoriesInclude  
  user.userSubsubCategories = associations.userSubsubCategories || []; // subsubcategoriesInclude
  user.goals = associations.goals || [];                           // goalsInclude
  
  // Additional associations for match calculation
  user.identityInterests = associations.identityInterests || [];
  user.categoryInterests = associations.categoryInterests || [];
  user.subcategoryInterests = associations.subcategoryInterests || [];
  user.subsubInterests = associations.subsubInterests || [];
  user.identities = associations.identities || [];
});*/








// Now fetch additional associations for each user separately
const userIds = rows.map(user => user.id);

// Fetch all associations in parallel
const [
  userInterests,
  userSubcategories,
  userSubsubCategories,
  userGoals,
  userIdentityInterests,
  userCategoryInterests,
  userSubcategoryInterests,
  userSubsubInterests,
  userIdentities,
  userIndustryCategories
] = await Promise.all([
  // UserCategory interests
  UserCategory.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(Object.keys(interestsWhere).length ? interestsWhere : {})
    },
    include: [
      { model: Category, as: "category", required: false },
      { model: Subcategory, as: "subcategory", required: false },
    ],
  }),
  
  // UserSubcategories
  require("../models").UserSubcategory.findAll({
    where: { userId: { [Op.in]: userIds } },
    include: [{ model: Subcategory, as: "subcategory", required: false }],
  }),
  
  // UserSubsubCategories
  require("../models").UserSubsubCategory.findAll({
    where: { userId: { [Op.in]: userIds } },
    include: [{ model: SubsubCategory, as: "subsubCategory", required: false }],
  }),
  
  // Goals
  User.findAll({
    where: { 
      id: { [Op.in]: userIds },
      ...(effGoalIds.length ? {
        '$goals.id$': { [Op.in]: effGoalIds }
      } : {})
    },
    include: [{
      model: Goal,
      as: "goals",
      required: false,
      through: { attributes: [] },
    }],
    attributes: ['id']
  }),
  
  // Identity Interests
  UserIdentityInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effIdentityIds.length ? { identityId: { [Op.in]: effIdentityIds } } : {})
    },
    include: [{ model: Identity, as: "identity" }],
  }),
  
  // Category Interests
  UserCategoryInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effAudienceCategoryIds.length ? { categoryId: { [Op.in]: effAudienceCategoryIds } } : {})
    },
    include: [{ model: Category, as: "category" }],
  }),
  
  // Subcategory Interests
  UserSubcategoryInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effAudienceSubcategoryIds.length ? { subcategoryId: { [Op.in]: effAudienceSubcategoryIds } } : {})
    },
    include: [{ model: Subcategory, as: "subcategory" }],
  }),
  
  // SubsubCategory Interests
  UserSubsubCategoryInterest.findAll({
    where: { 
      userId: { [Op.in]: userIds },
      ...(effAudienceSubsubCategoryIds.length ? { subsubCategoryId: { [Op.in]: effAudienceSubsubCategoryIds } } : {})
    },
    include: [{ model: SubsubCategory, as: "subsubCategory" }],
  }),
  
  // User Identities
  User.findAll({
    where: { id: { [Op.in]: userIds } },
    include: [{
      model: Identity,
      as: "identities",
      required: false,
      through: { attributes: [] },
    }],
    attributes: ['id']
  }),
  
  // Industry Categories
  User.findAll({
    where: { 
      id: { [Op.in]: userIds },
      ...(effIndustryIds.length ? {
        '$industryCategories.id$': { [Op.in]: effIndustryIds }
      } : {})
    },
    include: [{
      model: IndustryCategory,
      as: "industryCategories",
      required: false,
      through: { attributes: [] },
    }],
    attributes: ['id']
  })
]);

// Group associations by userId for easy lookup
const associationsByUserId = {};

userIds.forEach(userId => {
  associationsByUserId[userId] = {
    interests: userInterests.filter(interest => String(interest.userId) === String(userId)),
    userSubcategories: userSubcategories.filter(sub => String(sub.userId) === String(userId)),
    userSubsubCategories: userSubsubCategories.filter(sub => String(sub.userId) === String(userId)),
    goals: userGoals.find(user => String(user.id) === String(userId))?.goals || [],
    identityInterests: userIdentityInterests.filter(interest => String(interest.userId) === String(userId)),
    categoryInterests: userCategoryInterests.filter(interest => String(interest.userId) === String(userId)),
    subcategoryInterests: userSubcategoryInterests.filter(interest => String(interest.userId) === String(userId)),
    subsubInterests: userSubsubInterests.filter(interest => String(interest.userId) === String(userId)),
    identities: userIdentities.find(user => String(user.id) === String(userId))?.identities || [],
    industryCategories: userIndustryCategories.find(user => String(user.id) === String(userId))?.industryCategories || [],
  };
});

// Attach associations to each user object AND apply filtering

// Attach associations to each user object AND apply filtering based on what users OFFER
const filteredRows = rows.filter(user => {
  const userId = String(user.id);
  const associations = associationsByUserId[userId] || {};
  
  // Attach associations to user object
  user.interests = associations.interests || [];
  user.userSubcategories = associations.userSubcategories || [];
  user.userSubsubCategories = associations.userSubsubCategories || [];
  user.goals = associations.goals || [];
  user.identityInterests = associations.identityInterests || [];
  user.categoryInterests = associations.categoryInterests || [];
  user.subcategoryInterests = associations.subcategoryInterests || [];
  user.subsubInterests = associations.subsubInterests || [];
  user.identities = associations.identities || [];
  user.industryCategories = associations.industryCategories || [];
  
  // Apply filtering logic - filter on what users OFFER (not what they're interested in)
  
  // Identity filter - check user's identities (what they are/offer)
  if (effIdentityIds.length > 0) {
    const userIdentityIds = associations.identities.map(i => String(i.id));
    const hasMatchingIdentity = userIdentityIds.some(id => effIdentityIds.includes(id));
    if (!hasMatchingIdentity) {
      console.log(`Filtered out user ${userId} - no matching identity`);
      return false;
    }
  }
  
  // Audience Category filter - check user's categories (what they offer)
  if (effAudienceCategoryIds.length > 0) {
    const userCategoryIds = associations.interests.map(i => String(i.categoryId)).filter(Boolean);
    const hasMatchingCategory = userCategoryIds.some(id => effAudienceCategoryIds.includes(id));
    if (!hasMatchingCategory) {
      console.log(`Filtered out user ${userId} - no matching category`);
      return false;
    }
  }

  //warning
  
  // Audience Subcategory filter - check user's subcategories (what they offer)
  if (effAudienceSubcategoryIds.length > 0) {
    const userSubcategoryIds = associations.userSubcategories.map(i => String(i.subcategoryId)).filter(Boolean);
    const hasMatchingSubcategory = userSubcategoryIds.some(id => effAudienceSubcategoryIds.includes(id));
    if (!hasMatchingSubcategory) {
      console.log(`Filtered out user ${userId} - no matching subcategory`);
      return false;
    }
  }
  
  // Audience SubsubCategory filter - check user's subsubcategories (what they offer)
  if (effAudienceSubsubCategoryIds.length > 0) {
    const userSubsubCategoryIds = associations.userSubsubCategories.map(i => String(i.subsubCategoryId)).filter(Boolean);
    const hasMatchingSubsubCategory = userSubsubCategoryIds.some(id => effAudienceSubsubCategoryIds.includes(id));
    if (!hasMatchingSubsubCategory) {
      console.log(`Filtered out user ${userId} - no matching subsubcategory`);
      return false;
    }
  }
  
  // Industry filter - check user's industry categories (what they offer)
  if (effIndustryIds.length > 0) {
    const userIndustryIds = associations.industryCategories.map(i => String(i.id));
    const hasMatchingIndustry = userIndustryIds.some(id => effIndustryIds.includes(id));
    if (!hasMatchingIndustry) {
      console.log(`Filtered out user ${userId} - no matching industry`);
      return false;
    }
  }
  
  // Regular Category/Subcategory filters (from interests - what they offer)
  if (effCategoryIds.length > 0 || effSubcategoryIds.length > 0) {
    const userCategoryIds = associations.interests.map(i => String(i.categoryId)).filter(Boolean);
    const userSubcategoryIds = associations.interests.map(i => String(i.subcategoryId)).filter(Boolean);
    
    const hasMatchingCategory = effCategoryIds.length === 0 || 
      userCategoryIds.some(id => effCategoryIds.includes(id));
    const hasMatchingSubcategory = effSubcategoryIds.length === 0 || 
      userSubcategoryIds.some(id => effSubcategoryIds.includes(id));
    
    if (!hasMatchingCategory || !hasMatchingSubcategory) {
      console.log(`Filtered out user ${userId} - no matching category/subcategory`);
      return false;
    }
  }
  
  // Goal filter - check user's goals (what they're looking for)
  if (effGoalIds.length > 0) {
    const userGoalIds = associations.goals.map(g => String(g.id));
    const hasMatchingGoal = userGoalIds.some(id => effGoalIds.includes(id));
    if (!hasMatchingGoal) {
      console.log(`Filtered out user ${userId} - no matching goal`);
      return false;
    }
  }
  
  return true;
});

const finalRows = filteredRows;

    console.log(`=== PEOPLE SEARCH DEBUG - DATABASE RESULTS ===`);
    console.log(`Found ${rows.length} users from database query`);
    console.log(`Applied limit: ${fetchLimit}, offset: ${off}`);

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
    const calculateMatchPercentage = (u, useBidirectionalMatch = true) => {
      if (!currentUserId) {
        // When no current user, calculate based on applied filters (only taxonomy-based matching)
        const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
        let totalScore = 0, matchedFactors = 0;

        // Identity matching
        if (effIdentityIds.length) {
          const userIdentityIds = (u.identityInterests || []).map((i) => String(i.identityId)).filter(Boolean);
          const identityMatches = userIdentityIds.filter((id) => effIdentityIds.includes(id));
          if (identityMatches.length) {
            const pct = Math.min(1, identityMatches.length / effIdentityIds.length);
            totalScore += WEIGHTS.identity * pct; matchedFactors++;
          }
        }

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

        // Subsubcategory matching
        if (effAudienceSubsubCategoryIds.length) {
          const userSubsubs = (u.subsubCategoryInterests || []).map((i) => String(i.subsubCategoryId)).filter(Boolean);
          const subsubMatches = userSubsubs.filter((id) => effAudienceSubsubCategoryIds.includes(id));
          if (subsubMatches.length) {
            const pct = Math.min(1, subsubMatches.length / effAudienceSubsubCategoryIds.length);
            totalScore += WEIGHTS.subsubcategory * pct; matchedFactors++;
          }
        }

        return Math.max(0, Math.min(100, Math.round(totalScore)));
      }

      // UNIDIRECTIONAL MATCHING ALGORITHM: Check if target user satisfies current user's interests
      // Get current user's "looking for" (interests) - what they want from others
      const currentUserIdentityInterests = new Set(myIdentityInterests.map(i => String(i.identityId)));
      const currentUserCategoryInterests = new Set(myCategoryInterests.map(i => String(i.categoryId)));
      const currentUserSubcategoryInterests = new Set(mySubcategoryInterests.map(i => String(i.subcategoryId)));
      const currentUserSubsubCategoryInterests = new Set(mySubsubCategoryInterests.map(i => String(i.subsubCategoryId)));

      // Get target user's "does" (what they offer) - what they can provide
      const targetUserIdentities = new Set((u.identities || []).map(i => String(i.id)));
      const targetUserCategories = new Set((u.interests || []).map(i => String(i.categoryId)));
      const targetUserSubcategories = new Set((u.userSubcategories || []).map(i => String(i.subcategoryId)));
      const targetUserSubsubcategories = new Set((u.userSubsubCategories || []).map(i => String(i.subsubCategoryId)));

      // UNIDIRECTIONAL MATCHING LOGIC: Check if target satisfies current user's interests
      // Initialize the matches object
      const matches = {
        identity: 0,
        category: 0,
        subcategory: 0,
        subsubcategory: 0
      };

      // Debug logging
      console.log('=== UNIDIRECTIONAL MATCH ALGORITHM DEBUG ===');
          console.log('Current user interests (what they want):', {
        identity: [...currentUserIdentityInterests],
        category: [...currentUserCategoryInterests],
        subcategory: [...currentUserSubcategoryInterests],
        subsubcategory: [...currentUserSubsubCategoryInterests]
      });
 console.log('Target user does (what they offer):', {
        identity: [...targetUserIdentities],
        category: [...targetUserCategories],
        subcategory: [...targetUserSubcategories],
        subsubcategory: [...targetUserSubsubcategories]
      });

      // Additional logging for what current user does and what target user wants
      console.log('Current user does (what they offer):', {
        identity: myIdentities.map(i => i.id),
        category: myCategoryIds,
        subcategory: mySubcategoryIds,
        subsubcategory: mySubsubCategoryIds
      });
      console.log('Target user wants (what they are interested in):', {
        identity: (u.identityInterests || []).map(i => i.identityId),
        category: (u.categoryInterests || []).map(i => i.categoryId),
        subcategory: (u.subcategoryInterests || []).map(i => i.subcategoryId),
        subsubcategory: (u.subsubInterests || []).map(i => i.subsubCategoryId)
      });

      // Direction 1: Current user wants -> Target user does (UNIDIRECTIONAL)
      // 1. Identity matching - 100% if at least one match found
      if (currentUserIdentityInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserIdentityInterests].filter(x => targetUserIdentities.has(x)));
        matches.identity = targetUserMatches.size > 0 ? 1 : 0;
        console.log(`Identity match: ${targetUserMatches.size}/${currentUserIdentityInterests.size} = ${Math.round(matches.identity * 100)}%`);
      }

      // 2. Category matching
     /* if (currentUserCategoryInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserCategoryInterests].filter(x => targetUserCategories.has(x)));
        matches.category = targetUserMatches.size / currentUserCategoryInterests.size;
        console.log(`Category match: ${targetUserMatches.size}/${currentUserCategoryInterests.size} = ${Math.round(matches.category * 100)}%`);
      }

      // 3. Subcategory matching - exact matching only
      if (currentUserSubcategoryInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserSubcategoryInterests].filter(x => targetUserSubcategories.has(x)));
        matches.subcategory = targetUserMatches.size / currentUserSubcategoryInterests.size;
        console.log(`Subcategory match: ${targetUserMatches.size}/${currentUserSubcategoryInterests.size} = ${Math.round(matches.subcategory * 100)}%`);
      }

      // 4. Subsubcategory matching
      if (currentUserSubsubCategoryInterests.size > 0) {
        const targetUserMatches = new Set([...currentUserSubsubCategoryInterests].filter(x => targetUserSubsubcategories.has(x)));
        matches.subsubcategory = targetUserMatches.size / currentUserSubsubCategoryInterests.size;
        console.log(`Subsubcategory match: ${targetUserMatches.size}/${currentUserSubsubCategoryInterests.size} = ${Math.round(matches.subsubcategory * 100)}%`);
      }*/



        // Track which levels are actually applicable (have valid interests)
      const applicableLevels = {
        identity: currentUserIdentityInterests.size > 0,
        category: false, // Will be set based on validation
        subcategory: false, // Will be set based on validation
        subsubcategory: false // Will be set based on validation
      };



       // 2. Category matching - ONLY consider categories that belong to target user's identities
  if (currentUserCategoryInterests.size > 0) {
    // Filter current user's category interests to only include those valid for target user's identities
    const validCurrentUserCategoryInterests = new Set(
      [...currentUserCategoryInterests].filter(catId => 
        checkIfBelongs('category', catId, [...targetUserIdentities])
      )
    );
    
    console.log(`Valid category interests: ${validCurrentUserCategoryInterests.size} out of ${currentUserCategoryInterests.size}`);
    
    if (validCurrentUserCategoryInterests.size > 0) {
      applicableLevels.category = true;
      
      // Also filter target user's categories to only include valid ones
      const validTargetUserCategories = new Set(
        [...targetUserCategories].filter(catId =>
          checkIfBelongs('category', catId, [...targetUserIdentities])
        )
      );
      
      const targetUserMatches = new Set([...validCurrentUserCategoryInterests].filter(x => validTargetUserCategories.has(x)));
      matches.category = targetUserMatches.size / validCurrentUserCategoryInterests.size;
      console.log(`Category match: ${targetUserMatches.size}/${validCurrentUserCategoryInterests.size} = ${Math.round(matches.category * 100)}%`);
    } else {
      console.log('No valid category interests - ignoring category level in calculation');
      // Don't set applicableLevels.category to true, so it will be ignored
    }
  }

  // 3. Subcategory matching - ONLY consider subcategories that belong to target user's identities
  if (currentUserSubcategoryInterests.size > 0) {
    // Filter current user's subcategory interests to only include those valid for target user's identities
    const validCurrentUserSubcategoryInterests = new Set(
      [...currentUserSubcategoryInterests].filter(subId => 
        checkIfBelongs('subcategory', subId, [...targetUserIdentities])
      )
    );
    
    console.log(`Valid subcategory interests: ${validCurrentUserSubcategoryInterests.size} out of ${currentUserSubcategoryInterests.size}`);
    
    if (validCurrentUserSubcategoryInterests.size > 0) {
      applicableLevels.subcategory = true;
      
      // Also filter target user's subcategories to only include valid ones
      const validTargetUserSubcategories = new Set(
        [...targetUserSubcategories].filter(subId =>
          checkIfBelongs('subcategory', subId, [...targetUserIdentities])
        )
      );
      
      const targetUserMatches = new Set([...validCurrentUserSubcategoryInterests].filter(x => validTargetUserSubcategories.has(x)));
      matches.subcategory = targetUserMatches.size / validCurrentUserSubcategoryInterests.size;
      console.log(`Subcategory match: ${targetUserMatches.size}/${validCurrentUserSubcategoryInterests.size} = ${Math.round(matches.subcategory * 100)}%`);
    } else {
      console.log('No valid subcategory interests - ignoring subcategory level in calculation');
      // Don't set applicableLevels.subcategory to true, so it will be ignored
    }
  }

  // 4. Subsubcategory matching - ONLY consider subsubcategories that belong to target user's identities
  if (currentUserSubsubCategoryInterests.size > 0) {
    // Filter current user's subsubcategory interests to only include those valid for target user's identities
    const validCurrentUserSubsubCategoryInterests = new Set(
      [...currentUserSubsubCategoryInterests].filter(subsubId => 
        checkIfBelongs('subsubcategory', subsubId, [...targetUserIdentities])
      )
    );
    
    console.log(`Valid subsubcategory interests: ${validCurrentUserSubsubCategoryInterests.size} out of ${currentUserSubsubCategoryInterests.size}`);
    
    if (validCurrentUserSubsubCategoryInterests.size > 0) {
      applicableLevels.subsubcategory = true;
      
      // Also filter target user's subsubcategories to only include valid ones
      const validTargetUserSubsubcategories = new Set(
        [...targetUserSubsubcategories].filter(subsubId =>
          checkIfBelongs('subsubcategory', subsubId, [...targetUserIdentities])
        )
      );
      
      const targetUserMatches = new Set([...validCurrentUserSubsubCategoryInterests].filter(x => validTargetUserSubsubcategories.has(x)));
      matches.subsubcategory = targetUserMatches.size / validCurrentUserSubsubCategoryInterests.size;
      console.log(`Subsubcategory match: ${targetUserMatches.size}/${validCurrentUserSubsubCategoryInterests.size} = ${Math.round(matches.subsubcategory * 100)}%`);
    } else {
      console.log('No valid subsubcategory interests - ignoring subsubcategory level in calculation');
      // Don't set applicableLevels.subsubcategory to true, so it will be ignored
    }
  }


      // Calculate final percentage based ONLY on what the current user is looking for
      const WEIGHTS = { identity: 25, category: 25, subcategory: 25, subsubcategory: 25 };
      let totalScore = 0;
      let totalPossibleScore = 0;

      // Debug logging for final calculation
      console.log('=== FINAL CALCULATION DEBUG ===');
      console.log('Final matches:', matches);

      // Only include levels that the CURRENT USER (the one searching) has specified interests in
      // This ensures the percentage reflects only what the current user is looking for
     /* Object.keys(matches).forEach(level => {
        const currentUserHasInterest = (
          (level === 'identity' && currentUserIdentityInterests.size > 0) ||
          (level === 'category' && currentUserCategoryInterests.size > 0) ||
          (level === 'subcategory' && currentUserSubcategoryInterests.size > 0) ||
          (level === 'subsubcategory' && currentUserSubsubCategoryInterests.size > 0)
        );

        // Only include this level if the CURRENT USER is looking for it
        // This ensures we only evaluate what the searching user wants
        if (currentUserHasInterest) {
          totalScore += WEIGHTS[level] * matches[level];
          totalPossibleScore += WEIGHTS[level];
          console.log(`${level}: ${Math.round(WEIGHTS[level] * matches[level])}/${WEIGHTS[level]} (${Math.round(matches[level] * 100)}%)`);
        }
      });*/

        Object.keys(matches).forEach(level => {
          if (applicableLevels[level]) {
            totalScore += WEIGHTS[level] * matches[level];
            totalPossibleScore += WEIGHTS[level];
            console.log(`${level}: ${Math.round(WEIGHTS[level] * matches[level])}/${WEIGHTS[level]} (${Math.round(matches[level] * 100)}%)`);
          } else {
            console.log(`${level}: IGNORED - no valid interests for this level`);
          }
        });

      console.log(`Total score: ${Math.round(totalScore)}/${totalPossibleScore}`);

      // Return percentage based on mutual satisfaction
      if (totalPossibleScore === 0) return 0;
      const finalPercentage = Math.max(0, Math.min(100, Math.round((totalScore / totalPossibleScore) * 100)));
      console.log(`Final percentage: ${finalPercentage}%`);

      // If bidirectional matching is enabled, calculate and return average of both directions
      if (useBidirectionalMatch) {
        // Calculate reverse percentage - what target user would get if searching for current user
        const reverseMatches = {
          identity: 0,
          category: 0,
          subcategory: 0,
          subsubcategory: 0
        };

        // Get target user's "looking for" (interests) - what they want from others
        const targetUserIdentityInterests = new Set((u.identityInterests || []).map(i => String(i.identityId)));
        const targetUserCategoryInterests = new Set((u.categoryInterests || []).map(i => String(i.categoryId)));
        const targetUserSubcategoryInterests = new Set((u.subcategoryInterests || []).map(i => String(i.subcategoryId)));
        const targetUserSubsubCategoryInterests = new Set((u.subsubInterests || []).map(i => String(i.subsubCategoryId)));

        // Get current user's "does" (what they offer) - what they can provide
        const currentUserIdentities = new Set(myIdentities.map(i => String(i.id)));
        const currentUserCategories = new Set(myCategoryIds);
        const currentUserSubcategories = new Set(mySubcategoryIds);
        const currentUserSubsubcategories = new Set(mySubsubCategoryIds);

        console.log('=== REVERSE MATCH CALCULATION DEBUG ===');
        console.log('Target user interests (what they want):', {
          identity: [...targetUserIdentityInterests],
          category: [...targetUserCategoryInterests],
          subcategory: [...targetUserSubcategoryInterests],
          subsubcategory: [...targetUserSubsubCategoryInterests]
        });
        console.log('Current user does (what they offer):', {
          identity: [...currentUserIdentities],
          category: [...currentUserCategories],
          subcategory: [...currentUserSubcategories],
          subsubcategory: [...currentUserSubsubcategories]
        });

              // Track which levels are applicable for reverse matching
        const reverseApplicableLevels = {
          identity: false,
          category: false,
          subcategory: false,
          subsubcategory: false
        };

        // Direction 2: Target user wants -> Current user does (REVERSE DIRECTION)
        // 1. Identity matching - 100% if at least one match found
        if (targetUserIdentityInterests.size > 0) {
           reverseApplicableLevels.identity = true;
          const currentUserMatches = new Set([...targetUserIdentityInterests].filter(x => currentUserIdentities.has(x)));
          reverseMatches.identity = currentUserMatches.size > 0 ? 1 : 0;
          console.log(`Reverse identity match: ${currentUserMatches.size}/${targetUserIdentityInterests.size} = ${Math.round(reverseMatches.identity * 100)}%`);
        }

        // 2. Category matching
       /* if (targetUserCategoryInterests.size > 0) {
          const currentUserMatches = new Set([...targetUserCategoryInterests].filter(x => currentUserCategories.has(x)));
          reverseMatches.category = currentUserMatches.size / targetUserCategoryInterests.size;
          console.log(`Reverse category match: ${currentUserMatches.size}/${targetUserCategoryInterests.size} = ${Math.round(reverseMatches.category * 100)}%`);
        }

        // 3. Subcategory matching - exact matching only
        if (targetUserSubcategoryInterests.size > 0) {
          const currentUserMatches = new Set([...targetUserSubcategoryInterests].filter(x => currentUserSubcategories.has(x)));
          reverseMatches.subcategory = currentUserMatches.size / targetUserSubcategoryInterests.size;
          console.log(`Reverse subcategory match: ${currentUserMatches.size}/${targetUserSubcategoryInterests.size} = ${Math.round(reverseMatches.subcategory * 100)}%`);
        }

        // 4. Subsubcategory matching
        if (targetUserSubsubCategoryInterests.size > 0) {
          const currentUserMatches = new Set([...targetUserSubsubCategoryInterests].filter(x => currentUserSubsubcategories.has(x)));
          reverseMatches.subsubcategory = currentUserMatches.size / targetUserSubsubCategoryInterests.size;
          console.log(`Reverse subsubcategory match: ${currentUserMatches.size}/${targetUserSubsubCategoryInterests.size} = ${Math.round(reverseMatches.subsubcategory * 100)}%`);
        }

        */


        





          // 2. Category matching with taxonomy validation
  if (targetUserCategoryInterests.size > 0) {
    // Filter target user's category interests to only include those valid for current user's identities
    const validTargetUserCategoryInterests = new Set(
      [...targetUserCategoryInterests].filter(catId => 
        checkIfBelongs('category', catId, [...currentUserIdentities])
      )
    );
    
    console.log(`Reverse valid category interests: ${validTargetUserCategoryInterests.size} out of ${targetUserCategoryInterests.size}`);
    
    if (validTargetUserCategoryInterests.size > 0) {
      reverseApplicableLevels.category = true;
      
      // Use all current user categories (don't filter offerings)
      const currentUserMatches = new Set([...validTargetUserCategoryInterests].filter(x => currentUserCategories.has(x)));
      reverseMatches.category = currentUserMatches.size / validTargetUserCategoryInterests.size;
      console.log(`Reverse category match: ${currentUserMatches.size}/${validTargetUserCategoryInterests.size} = ${Math.round(reverseMatches.category * 100)}%`);
    } else {
      console.log('No valid reverse category interests - ignoring category level in reverse calculation');
    }
  }

  // 3. Subcategory matching with taxonomy validation
  if (targetUserSubcategoryInterests.size > 0) {
    // Filter target user's subcategory interests to only include those valid for current user's identities
    const validTargetUserSubcategoryInterests = new Set(
      [...targetUserSubcategoryInterests].filter(subId => 
        checkIfBelongs('subcategory', subId, [...currentUserIdentities])
      )
    );
    
    console.log(`Reverse valid subcategory interests: ${validTargetUserSubcategoryInterests.size} out of ${targetUserSubcategoryInterests.size}`);
    
    if (validTargetUserSubcategoryInterests.size > 0) {
      reverseApplicableLevels.subcategory = true;
      
      // Use all current user subcategories (don't filter offerings)
      const currentUserMatches = new Set([...validTargetUserSubcategoryInterests].filter(x => currentUserSubcategories.has(x)));
      reverseMatches.subcategory = currentUserMatches.size / validTargetUserSubcategoryInterests.size;
      console.log(`Reverse subcategory match: ${currentUserMatches.size}/${validTargetUserSubcategoryInterests.size} = ${Math.round(reverseMatches.subcategory * 100)}%`);
    } else {
      console.log('No valid reverse subcategory interests - ignoring subcategory level in reverse calculation');
    }
  }

  // 4. Subsubcategory matching with taxonomy validation
  if (targetUserSubsubCategoryInterests.size > 0) {
    // Filter target user's subsubcategory interests to only include those valid for current user's identities
    const validTargetUserSubsubCategoryInterests = new Set(
      [...targetUserSubsubCategoryInterests].filter(subsubId => 
        checkIfBelongs('subsubcategory', subsubId, [...currentUserIdentities])
      )
    );
    
    console.log(`Reverse valid subsubcategory interests: ${validTargetUserSubsubCategoryInterests.size} out of ${targetUserSubsubCategoryInterests.size}`);
    
    if (validTargetUserSubsubCategoryInterests.size > 0) {
      reverseApplicableLevels.subsubcategory = true;
      
      // Use all current user subsubcategories (don't filter offerings)
      const currentUserMatches = new Set([...validTargetUserSubsubCategoryInterests].filter(x => currentUserSubsubcategories.has(x)));
      reverseMatches.subsubcategory = currentUserMatches.size / validTargetUserSubsubCategoryInterests.size;
      console.log(`Reverse subsubcategory match: ${currentUserMatches.size}/${validTargetUserSubsubCategoryInterests.size} = ${Math.round(reverseMatches.subsubcategory * 100)}%`);
    } else {
      console.log('No valid reverse subsubcategory interests - ignoring subsubcategory level in reverse calculation');
    }
  }




        // Calculate reverse percentage based ONLY on what the target user is looking for
        let reverseTotalScore = 0;
        let reverseTotalPossibleScore = 0;

        console.log('=== REVERSE FINAL CALCULATION DEBUG ===');
        console.log('Reverse matches:', reverseMatches);

        // Only include levels that the TARGET USER has specified interests in
        /*Object.keys(reverseMatches).forEach(level => {
          const targetUserHasInterest = (
            (level === 'identity' && targetUserIdentityInterests.size > 0) ||
            (level === 'category' && targetUserCategoryInterests.size > 0) ||
            (level === 'subcategory' && targetUserSubcategoryInterests.size > 0) ||
            (level === 'subsubcategory' && targetUserSubsubCategoryInterests.size > 0)
          );

          if (targetUserHasInterest) {
            reverseTotalScore += WEIGHTS[level] * reverseMatches[level];
            reverseTotalPossibleScore += WEIGHTS[level];
            console.log(`Reverse ${level}: ${Math.round(WEIGHTS[level] * reverseMatches[level])}/${WEIGHTS[level]} (${Math.round(reverseMatches[level] * 100)}%)`);
          }
        });*/

         Object.keys(reverseMatches).forEach(level => {
            if (reverseApplicableLevels[level]) {
              reverseTotalScore += WEIGHTS[level] * reverseMatches[level];
              reverseTotalPossibleScore += WEIGHTS[level];
              console.log(`Reverse ${level}: ${Math.round(WEIGHTS[level] * reverseMatches[level])}/${WEIGHTS[level]} (${Math.round(reverseMatches[level] * 100)}%)`);
            } else {
              console.log(`Reverse ${level}: IGNORED - no valid interests for this level`);
            }
          });

        console.log(`Reverse total score: ${Math.round(reverseTotalScore)}/${reverseTotalPossibleScore}`);

        if (reverseTotalPossibleScore === 0) {
          console.log('Reverse percentage: 0% (target user has no interests specified)');
          const reversePercentage = 0;
          const bidirectionalPercentage = (userBidirectionalMatchFormula === "simple")
            ? calculateBidirectionalMatch(finalPercentage, reversePercentage)
            : calculateReciprocalWeightedMatch(finalPercentage, reversePercentage);
          console.log(`Bidirectional percentage (${userBidirectionalMatchFormula} of ${finalPercentage}% and ${reversePercentage}%): ${Math.round(bidirectionalPercentage)}%`);
          return Math.round(bidirectionalPercentage);
        } else {
           const reversePercentage = Math.max(0, Math.min(100, Math.round((reverseTotalScore / reverseTotalPossibleScore) * 100)));
           const bidirectionalPercentage = (userBidirectionalMatchFormula === "simple")
             ? calculateBidirectionalMatch(finalPercentage, reversePercentage)
             : calculateReciprocalWeightedMatch(finalPercentage, reversePercentage);
           console.log(`Bidirectional percentage (${userBidirectionalMatchFormula} of ${finalPercentage}% and ${reversePercentage}%): ${Math.round(bidirectionalPercentage)}%`);
           return Math.round(bidirectionalPercentage);
         }
      }

      return finalPercentage;
    };

      let items = finalRows.map((u) => {
      const matchPercentage = calculateMatchPercentage(u, userBidirectionalMatch === 'true' || userBidirectionalMatch === true);
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

    console.log('=== PEOPLE SEARCH DEBUG - AFTER MATCH CALCULATION ===');
    console.log(`Items before sorting: ${items.length}`);
    if (items.length > 0) {
      const matchPercentages = items.map(item => item.out.matchPercentage);
      console.log(`Match percentage range: ${Math.min(...matchPercentages)}% - ${Math.max(...matchPercentages)}%`);
      console.log(`Average match percentage: ${Math.round(matchPercentages.reduce((a, b) => a + b, 0) / matchPercentages.length)}%`);
    }

    // Sort by matchPercentage then recency
    items.sort((a, b) => {
      if (a.out.matchPercentage !== b.out.matchPercentage) return b.out.matchPercentage - a.out.matchPercentage;
      return new Date(b.raw.createdAt) - new Date(a.raw.createdAt);
    });

    console.log('=== PEOPLE SEARCH DEBUG - AFTER SORTING ===');
    console.log(`Items after sorting: ${items.length}`);
    if (items.length > 0) {
      const sortedMatchPercentages = items.map(item => item.out.matchPercentage);
      console.log(`Sorted match percentages (first 10): ${sortedMatchPercentages.slice(0, 10).join(', ')}`);
    }

    // Optional connection status filter
    if (ensureArray(connectionStatus).length) {
      const beforeFilterCount = items.length;
      const allow = new Set(ensureArray(connectionStatus).map((s) => s.toLowerCase()));
      items = items.filter((x) => allow.has(x.out.connectionStatus));
      console.log(`=== PEOPLE SEARCH DEBUG - CONNECTION STATUS FILTER ===`);
      console.log(`Items before connection filter: ${beforeFilterCount}`);
      console.log(`Items after connection filter: ${items.length}`);
      console.log(`Applied connection status filter: ${Array.from(allow).join(', ')}`);
    }

    const windowed = items.slice(off, off + lim).map((x) => x.out);

    console.log('=== PEOPLE SEARCH DEBUG - FINAL RESULTS ===');
    console.log(`Total items after match calculation: ${items.length}`);
    console.log(`Applied pagination - offset: ${off}, limit: ${lim}`);
    console.log(`Items in final window: ${windowed.length}`);
    console.log(`First few match percentages: ${windowed.slice(0, 5).map(item => item.matchPercentage).join(', ')}`);

    if (items.length > 0) {
      console.log('Sample item structure:', {
        id: windowed[0]?.id,
        name: windowed[0]?.name,
        matchPercentage: windowed[0]?.matchPercentage,
        connectionStatus: windowed[0]?.connectionStatus,
        accountType: windowed[0]?.accountType
      });
    }

    const response = { count: items.length, items: windowed, sortedBy: "matchPercentage" };

    console.log('=== PEOPLE SEARCH DEBUG - RESPONSE ===');
    console.log(`Final response count: ${response.count}`);
    console.log(`Final response items length: ${response.items.length}`);

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