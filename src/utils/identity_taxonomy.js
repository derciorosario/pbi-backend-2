
const fs = require("fs");
const path = require("path");
const {
  Category,
  Subcategory,
  SubsubCategory,
  Goal,
  Identity,
} = require("../models");
async function getIdentityCatalogFunc(type){

    // Load the single JSON blueprint
    const file = path.join(__dirname, "../../seed/identity_category_map.json");
    const blueprint = JSON.parse(fs.readFileSync(file, "utf8"));

    // Pick correct section based on type (for 'all' we merge both)
    let blueprintIdentities;
    if (type === "all") {
      const indy = (blueprint.identities || []).map((i) => ({
        ...i,
        __identityType: "individual",
      }));
      const comp = (blueprint.company_identities || []).map((i) => ({
        ...i,
        __identityType: "company",
      }));
      blueprintIdentities = [...indy, ...comp];
    } else if (type === "company") {
      blueprintIdentities = (blueprint.company_identities || []).map((i) => ({
        ...i,
        __identityType: "company",
      }));
    } else {
      blueprintIdentities = (blueprint.identities || []).map((i) => ({
        ...i,
        __identityType: "individual",
      }));
    }

    // ---- Fetch canonical taxonomy from DB ----
    // Categories (+ subcategories) — filter by type unless "all"
    const catWhere =
      type === "all" ? {} : { type }; // include both types when 'all'

    const cats = await Category.findAll({
      attributes: ["id", "name", "type"],
      where: catWhere,
      include: [
        {
          model: Subcategory,
          as: "subcategories",
          attributes: ["id", "name", "categoryId", "type"],
          // If 'all', do not filter subcategory type; otherwise keep same filter
          where: type === "all" ? undefined : { type },
          required: false,
        },
      ],
      order: [["name", "ASC"]],
    });

    // Subsubs — filter by type unless 'all'
    const subsubWhere =
      type === "all" ? {} : { type };

    const allSubsubs = await SubsubCategory.findAll({
      attributes: ["id", "name", "subcategoryId", "type"],
      where: subsubWhere,
    });

    // ---- Build lookup maps (type-aware to avoid collisions) ----
    // Category by (type:name)
    const catByTypeAndName = new Map(
      cats.map((c) => [
        `${(c.type || "").trim().toLowerCase()}::${c.name.trim().toLowerCase()}`,
        c,
      ])
    );

    // Subcategory by (catType:catName::subName)
    const subsByTypeCatAndSubName = new Map();
    for (const c of cats) {
      for (const s of c.subcategories || []) {
        subsByTypeCatAndSubName.set(
          `${(c.type || "").trim().toLowerCase()}::${c.name
            .trim()
            .toLowerCase()}::${s.name.trim().toLowerCase()}`,
          s
        );
      }
    }

    // Subsub by (subcategoryId::subsubName)
    const subsubsBySubIdAndName = new Map(
      allSubsubs.map((ss) => [
        `${ss.subcategoryId}::${ss.name.trim().toLowerCase()}`,
        ss,
      ])
    );

    // ---- Map JSON blueprint → attach IDs from canonical taxonomy where possible ----
    const identities = await Promise.all(
      blueprintIdentities.map(async (identity) => {
        const identityType = identity.__identityType; // 'individual' | 'company'

        const categories = (identity.categories || []).map((cat) => {
          const catKey = `${identityType}::${cat.name.trim().toLowerCase()}`;
          const foundCat = catByTypeAndName.get(catKey) || null;

          const subcategories = (cat.subcategories || []).map((sub) => {
            let foundSub = null;
            if (foundCat) {
              const key = `${identityType}::${foundCat.name
                .trim()
                .toLowerCase()}::${sub.name.trim().toLowerCase()}`;
              foundSub = subsByTypeCatAndSubName.get(key) || null;
            }

            const subsubs = (sub.subsubs || []).map((ssName) => {
              let foundSs = null;
              if (foundSub) {
                const ssKey = `${foundSub.id}::${String(ssName)
                  .trim()
                  .toLowerCase()}`;
                foundSs = subsubsBySubIdAndName.get(ssKey) || null;
              }
              return { id: foundSs ? foundSs.id : null, name: String(ssName) };
            });

            return {
              id: foundSub ? foundSub.id : null,
              name: sub.name,
              subsubs,
            };
          });

          return {
            id: foundCat ? foundCat.id : null,
            name: cat.name,
            subcategories,
          };
        });

        // Fetch identity row filtered by the specific identity's type
        const identityRow = await Identity.findOne({
          where: { name: identity.name.trim(), type: identityType },
        });

        return {
          name: identity.name,
          type: identityType,
          id: identityRow ? identityRow.id : null,
          categories,
        };
      })
    );

    return identities

}


module.exports={getIdentityCatalogFunc}