// src/seeds/seedNews.js
require("dotenv").config();

const { sequelize, User, Profile } = require("../models");

async function getUser(email) {
  return User.findOne({ where: { email } });
}
async function getProfile(userId) {
  return Profile.findOne({ where: { userId } });
}

async function upsertArticle(whereFields, payload) {

}


function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const CATEGORIES = ["Business", "Technology", "Policy", "Trade", "Culture"];
const COUNTRIES  = ["All African Countries", "Nigeria", "Ghana", "Kenya", "South Africa", "Morocco", "Egypt", "Rwanda", "Ethiopia", "Senegal"];

const BULK_ARTICLES = [
  {
    authorEmail: "company@54links.com",
    title: "Market Intelligence: Top 10 Growth Sectors in West Africa (2025)",
    category: "Business",
    countryFocus: "All African Countries",
    tags: ["market", "west-africa", "growth"],
    status: "published",
  },
  {
    authorEmail: "afri-agro@54links.com",
    title: "AgriTech Innovations Boost Yields for Smallholders",
    category: "Technology",
    countryFocus: "Ghana",
    tags: ["agritech", "smes", "yields"],
    status: "published",
  },
  {
    authorEmail: "sa-renew@54links.com",
    title: "Renewables Roundup: Utility-Scale Solar in SADC",
    category: "Trade",
    countryFocus: "South Africa",
    tags: ["renewables", "solar", "sadc"],
    status: "published",
  },
  {
    authorEmail: "naija-fintech@54links.com",
    title: "Payments Interoperability: What It Means for SMEs",
    category: "Policy",
    countryFocus: "Nigeria",
    tags: ["fintech", "interoperability", "smes"],
    status: "published",
  },
  {
    authorEmail: "kenya-logistics@54links.com",
    title: "Cross-Border Logistics: Lessons from E-commerce",
    category: "Trade",
    countryFocus: "Kenya",
    tags: ["logistics", "ecommerce", "cross-border"],
    status: "published",
  },
  {
    authorEmail: "content.admin@54links.com",
    title: "Creative Economy Spotlight: Film & Games",
    category: "Culture",
    countryFocus: "Morocco",
    tags: ["media", "games", "film"],
    status: "published",
  },
  {
    authorEmail: "ops.admin@54links.com",
    title: "Policy Tracker: Data Protection & AI Governance",
    category: "Policy",
    countryFocus: "Rwanda",
    tags: ["policy", "data", "ai"],
    status: "published",
  },
  {
    authorEmail: "individual@54links.com",
    title: "How to Pitch to African VCs",
    category: "Business",
    countryFocus: "All African Countries",
    tags: ["fundraising", "vc", "pitch"],
    status: "draft",
  },
  {
    authorEmail: "amara.dev@54links.com",
    title: "Frontend Patterns for High-Performance Dashboards",
    category: "Technology",
    countryFocus: "Kenya",
    tags: ["react", "performance", "dashboards"],
    status: "published",
  },
  {
    authorEmail: "youssef.data@54links.com",
    title: "Data Storytelling for Marketplace Growth",
    category: "Business",
    countryFocus: "Morocco",
    tags: ["data", "growth", "marketplace"],
    status: "published",
  },
  {
    authorEmail: "helena.events@54links.com",
    title: "Event Playbook: Sponsorships That Work",
    category: "Business",
    countryFocus: "South Africa",
    tags: ["events", "sponsorship", "b2b"],
    status: "published",
  },
  {
    authorEmail: "chinedu.hr@54links.com",
    title: "Hiring in Pan-African Teams: Process & Tools",
    category: "Business",
    countryFocus: "Nigeria",
    tags: ["hr", "hiring", "remote"],
    status: "published",
  },
  // add many more programmatically:
  // We'll auto-fill 12 more randomized articles
];

while (BULK_ARTICLES.length < 24) {
  const authorPool = [
    "company@54links.com", "afri-agro@54links.com", "sa-renew@54links.com",
    "naija-fintech@54links.com", "kenya-logistics@54links.com", "content.admin@54links.com",
    "ops.admin@54links.com", "individual@54links.com", "amara.dev@54links.com",
    "youssef.data@54links.com", "helena.events@54links.com", "chinedu.hr@54links.com",
  ];
  const cat = pick(CATEGORIES);
  const ctry = pick(COUNTRIES);
  const title = `${cat} Insight: ${ctry} — ${Math.random().toString(36).slice(2,7).toUpperCase()}`;
  BULK_ARTICLES.push({
    authorEmail: pick(authorPool),
    title,
    category: cat,
    countryFocus: ctry,
    tags: [cat.toLowerCase(), ctry.toLowerCase()],
    status: Math.random() > 0.15 ? "published" : "draft",
  });
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 DB connected (news seed).");

    // Optionally: await sequelize.sync({ alter: true });


    // After your three initial upsertArticle() calls, add:
for (const a of BULK_ARTICLES) {
  const author = await getUser(a.authorEmail);
  if (!author) { console.log(`⚠️ Missing author ${a.authorEmail}`); continue; }
  const prof = await getProfile(author.id);

  await upsertArticle(
    { title: a.title },
    {
      userId: author.id,
      profileId: prof?.id || null,
      title: a.title,
      category: a.category,
      countryFocus: a.countryFocus,
      featuredImage: null, // or set to a URL/base64 if you want
      content: `This is a seeded ${a.category} article focused on ${a.countryFocus}. It covers trends, analysis and opportunities across the Pan-African ecosystem.`,
      tags: a.tags,
      status: a.status,
      publishedAt: a.status === "published" ? new Date() : null,
      scheduledFor: null,
    }
  );
}

console.log(`📰 Bulk news created: ${BULK_ARTICLES.length}`);
    console.log("✅ News seeding completed.");
   // process.exit(0);
  } catch (err) {
    console.error("❌ News seeding failed:", err);
    //process.exit(1);
  }
})();
