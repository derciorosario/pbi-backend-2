const { body } = require("express-validator");

// multiple identities (UUIDs)
const setIdentities = [
  body("primaryIdentity").isArray({ min: 1 }),
  body("primaryIdentity.*").isUUID().withMessage("identityIds must be UUIDs"),
];

const setCategories = [
  body("categoryIds").isArray({ min: 1 }),
  body("subcategoryIds").isArray({ min: 1 }),
  body("subsubCategoryIds").optional().isArray(),
];

const setGoals = [
  body("goalIds").isArray().custom((a) => Array.isArray(a) && a.length > 0 && a.length <= 3),
];

module.exports = { setIdentities, setCategories, setGoals };
