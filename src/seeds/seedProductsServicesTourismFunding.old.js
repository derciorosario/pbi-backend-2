// src/seeds/seedProductsServicesTourismFunding.js
require("dotenv").config();

const {
  sequelize,
  User,
  Category,
  Subcategory,
  SubsubCategory,
  Identity,
  Product,
  Service,
  Tourism,
  Funding,
  Event,
  Job,
  ProductCategory,
  ProductSubcategory,
  ProductSubsubCategory,
  ProductIdentity,
  ServiceCategory,
  ServiceSubcategory,
  ServiceSubsubCategory,
  ServiceIdentity,
  TourismCategory,
  TourismSubcategory,
  TourismSubsubCategory,
  TourismIdentity,
  FundingCategory,
  FundingSubcategory,
  FundingSubsubCategory,
  FundingIdentity,
  EventCategory,
  EventSubcategory,
  EventSubsubCategory,
  EventIdentity,
  JobCategory,
  JobSubcategory,
  JobSubsubCategory,
  JobIdentity,
  GeneralCategory,
  GeneralSubcategory,
  GeneralSubsubCategory,
  IndustryCategory,
  IndustrySubcategory,
  IndustrySubsubCategory,
} = require("../models");

/** ------------------------- Helpers ------------------------- **/

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function upsertCategoryByName(name) {
  if (!name) return null;
  let cat = await Category.findOne({ where: { name } });
  if (!cat) {
    cat = await Category.create({ name });
    console.log(`➕ Category created: ${name}`);
  }
  return cat;
}

async function upsertSubcategoryByName(categoryName, subName) {
  if (!categoryName || !subName) return null;
  const cat = await upsertCategoryByName(categoryName);
  let sub = await Subcategory.findOne({
    where: { name: subName, categoryId: cat.id },
  });
  if (!sub) {
    sub = await Subcategory.create({ name: subName, categoryId: cat.id });
    console.log(`   ↳ Subcategory created: ${categoryName} > ${subName}`);
  }
  return sub;
}

async function upsertSubsubCategoryByName(categoryName, subcategoryName, subsubName) {
  if (!categoryName || !subcategoryName || !subsubName) return null;
  const sub = await upsertSubcategoryByName(categoryName, subcategoryName);
  let subsub = await SubsubCategory.findOne({
    where: { name: subsubName, subcategoryId: sub.id },
  });
  if (!subsub) {
    subsub = await SubsubCategory.create({ name: subsubName, subcategoryId: sub.id });
    console.log(`      ↳ SubsubCategory created: ${categoryName} > ${subcategoryName} > ${subsubName}`);
  }
  return subsub;
}

async function upsertIdentityByName(name) {
  if (!name) return null;
  let identity = await Identity.findOne({ where: { name } });
  if (!identity) {
    identity = await Identity.create({ name });
    console.log(`➕ Identity created: ${name}`);
  }
  return identity;
}

async function getUserIdByEmail(email) {
  const u = await User.findOne({ where: { email } });
  if (!u) throw new Error(`User not found for email: ${email}`);
  return u.id;
}

async function upsertGeneralCategoryByName(name, type) {
  if (!name || !type) return null;
  let cat = await GeneralCategory.findOne({ where: { name, type } });
  if (!cat) {
    cat = await GeneralCategory.create({ name, type });
    console.log(`➕ General Category created: ${name} (${type})`);
  }
  return cat;
}

async function upsertGeneralSubcategoryByName(categoryName, subName, type) {
  if (!categoryName || !subName || !type) return null;
  const cat = await upsertGeneralCategoryByName(categoryName, type);
  let sub = await GeneralSubcategory.findOne({
    where: { name: subName, generalCategoryId: cat.id },
  });
  if (!sub) {
    sub = await GeneralSubcategory.create({ name: subName, generalCategoryId: cat.id });
    console.log(`   ↳ General Subcategory created: ${categoryName} > ${subName}`);
  }
  return sub;
}

async function upsertGeneralSubsubCategoryByName(categoryName, subcategoryName, subsubName, type) {
  if (!categoryName || !subcategoryName || !subsubName || !type) return null;
  const sub = await upsertGeneralSubcategoryByName(categoryName, subcategoryName, type);
  let subsub = await GeneralSubsubCategory.findOne({
    where: { name: subsubName, generalSubcategoryId: sub.id },
  });
  if (!subsub) {
    subsub = await GeneralSubsubCategory.create({ name: subsubName, generalSubcategoryId: sub.id });
    console.log(`      ↳ General SubsubCategory created: ${categoryName} > ${subcategoryName} > ${subsubName}`);
  }
  return subsub;
}

// Industry Category helpers
async function upsertIndustryCategoryByName(name) {
  if (!name) return null;
  let cat = await IndustryCategory.findOne({ where: { name } });
  if (!cat) {
    cat = await IndustryCategory.create({ name });
    console.log(`➕ Industry Category created: ${name}`);
  }
  return cat;
}

async function upsertIndustrySubcategoryByName(categoryName, subName) {
  if (!categoryName || !subName) return null;
  const cat = await upsertIndustryCategoryByName(categoryName);
  let sub = await IndustrySubcategory.findOne({
    where: { name: subName, industryCategoryId: cat.id },
  });
  if (!sub) {
    sub = await IndustrySubcategory.create({ name: subName, industryCategoryId: cat.id });
    console.log(`   ↳ Industry Subcategory created: ${categoryName} > ${subName}`);
  }
  return sub;
}

async function upsertIndustrySubsubCategoryByName(categoryName, subcategoryName, subsubName) {
  if (!categoryName || !subcategoryName || !subsubName) return null;
  const sub = await upsertIndustrySubcategoryByName(categoryName, subcategoryName);
  let subsub = await IndustrySubsubCategory.findOne({
    where: { name: subsubName, industrySubcategoryId: sub.id },
  });
  if (!subsub) {
    subsub = await IndustrySubsubCategory.create({ name: subsubName, industrySubcategoryId: sub.id });
    console.log(`      ↳ Industry SubsubCategory created: ${categoryName} > ${subcategoryName} > ${subsubName}`);
  }
  return subsub;
}

// Generic function to associate entities with audience
async function associateWithAudience(entity, entityType, audienceData) {
  if (!audienceData) return;
  
  const { categories, subcategories, subsubcategories, identities } = audienceData;
  
  // Associate with categories
  if (categories && categories.length > 0) {
    const categoryIds = [];
    for (const catName of categories) {
      const cat = await upsertCategoryByName(catName);
      if (cat) categoryIds.push(cat.id);
    }
    
    switch (entityType) {
      case 'product':
        await entity.setAudienceCategories(categoryIds);
        break;
      case 'service':
        await entity.setAudienceCategories(categoryIds);
        break;
      case 'tourism':
        await entity.setAudienceCategories(categoryIds);
        break;
      case 'funding':
        await entity.setAudienceCategories(categoryIds);
        break;
      case 'event':
        await entity.setAudienceCategories(categoryIds);
        break;
      case 'job':
        await entity.setAudienceCategories(categoryIds);
        break;
    }
  }
  
  // Associate with subcategories
  if (subcategories && subcategories.length > 0) {
    const subcategoryIds = [];
    for (const sub of subcategories) {
      if (typeof sub === 'string') {
        // Format: "categoryName > subcategoryName"
        const [catName, subName] = sub.split(' > ').map(s => s.trim());
        const subcat = await upsertSubcategoryByName(catName, subName);
        if (subcat) subcategoryIds.push(subcat.id);
      } else if (typeof sub === 'object') {
        // Format: { category: "categoryName", subcategory: "subcategoryName" }
        const subcat = await upsertSubcategoryByName(sub.category, sub.subcategory);
        if (subcat) subcategoryIds.push(subcat.id);
      }
    }
    
    switch (entityType) {
      case 'product':
        await entity.setAudienceSubcategories(subcategoryIds);
        break;
      case 'service':
        await entity.setAudienceSubcategories(subcategoryIds);
        break;
      case 'tourism':
        await entity.setAudienceSubcategories(subcategoryIds);
        break;
      case 'funding':
        await entity.setAudienceSubcategories(subcategoryIds);
        break;
      case 'event':
        await entity.setAudienceSubcategories(subcategoryIds);
        break;
      case 'job':
        await entity.setAudienceSubcategories(subcategoryIds);
        break;
    }
  }
  
  // Associate with subsubcategories
  if (subsubcategories && subsubcategories.length > 0) {
    const subsubcategoryIds = [];
    for (const subsub of subsubcategories) {
      if (typeof subsub === 'string') {
        // Format: "categoryName > subcategoryName > subsubcategoryName"
        const [catName, subName, subsubName] = subsub.split(' > ').map(s => s.trim());
        const subsubcat = await upsertSubsubCategoryByName(catName, subName, subsubName);
        if (subsubcat) subsubcategoryIds.push(subsubcat.id);
      } else if (typeof subsub === 'object') {
        // Format: { category: "categoryName", subcategory: "subcategoryName", subsubcategory: "subsubcategoryName" }
        const subsubcat = await upsertSubsubCategoryByName(subsub.category, subsub.subcategory, subsub.subsubcategory);
        if (subsubcat) subsubcategoryIds.push(subsubcat.id);
      }
    }
    
    switch (entityType) {
      case 'product':
        await entity.setAudienceSubsubs(subsubcategoryIds);
        break;
      case 'service':
        await entity.setAudienceSubsubs(subsubcategoryIds);
        break;
      case 'tourism':
        await entity.setAudienceSubsubs(subsubcategoryIds);
        break;
      case 'funding':
        await entity.setAudienceSubsubs(subsubcategoryIds);
        break;
      case 'event':
        await entity.setAudienceSubsubs(subsubcategoryIds);
        break;
      case 'job':
        await entity.setAudienceSubsubs(subsubcategoryIds);
        break;
    }
  }
  
  // Associate with identities
  if (identities && identities.length > 0) {
    const identityIds = [];
    for (const idName of identities) {
      const identity = await upsertIdentityByName(idName);
      if (identity) identityIds.push(identity.id);
    }
    
    switch (entityType) {
      case 'product':
        await entity.setAudienceIdentities(identityIds);
        break;
      case 'service':
        await entity.setAudienceIdentities(identityIds);
        break;
      case 'tourism':
        await entity.setAudienceIdentities(identityIds);
        break;
      case 'funding':
        await entity.setAudienceIdentities(identityIds);
        break;
      case 'event':
        await entity.setAudienceIdentities(identityIds);
        break;
      case 'job':
        await entity.setAudienceIdentities(identityIds);
        break;
    }
  }
}

/** ------------------------- Seed Data ------------------------- **/

// Product Seeds
const PRODUCT_SEEDS = [
  {
    title: "Handcrafted Leather Bag",
    description: "Authentic handcrafted leather bag made by local artisans. Perfect for everyday use and special occasions.",
    price: 120.00,
    quantity: 15,
    country: "Kenya",
    tags: ["leather", "handcrafted", "accessories", "fashion"],
    images: [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7",
      "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3"
    ],
    sellerEmail: "kenya-logistics@54links.com",
    categoryName: "Fashion & Apparel",
    subcategoryName: "Accessories",
    generalCategoryName: "Fashion & Apparel",
    generalSubcategoryName: "Bags",
    industryCategoryName: "Manufacturing",
    industrySubcategoryName: "Textiles & Apparel",
    createdAtDaysAgo: 5,
    audience: {
      categories: ["Fashion & Apparel", "Trade"],
      subcategories: [
        "Fashion & Apparel > Accessories",
        { category: "Trade", subcategory: "Fashion" }
      ],
      subsubcategories: [
        "Trade > Fashion > Accessories"
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses"]
    }
  },
  {
    title: "African Print Fabric - 6 Yards",
    description: "Vibrant African print fabric, perfect for clothing, home decor, and accessories. 100% cotton, 6 yards.",
    price: 45.00,
    quantity: 50,
    country: "Ghana",
    tags: ["fabric", "african print", "textile", "ankara"],
    images: [
      "https://images.unsplash.com/photo-1534137667199-675a46e143f3",
      "https://images.unsplash.com/photo-1589891685391-c1c1a2c4f1df"
    ],
    sellerEmail: "afri-agro@54links.com",
    categoryName: "Fashion & Apparel",
    subcategoryName: "Textiles",
    generalCategoryName: "Fashion & Apparel",
    generalSubcategoryName: "Textiles",
    industryCategoryName: "Manufacturing",
    industrySubcategoryName: "Textiles & Apparel",
    createdAtDaysAgo: 10,
    audience: {
      categories: ["Fashion & Apparel", "Trade"],
      subcategories: [
        "Fashion & Apparel > Textiles",
        { category: "Trade", subcategory: "Fashion" }
      ],
      identities: ["Entrepreneurs", "Creative & Artist"]
    }
  },
  {
    title: "Solar Powered Phone Charger",
    description: "Portable solar-powered phone charger with 10,000mAh capacity. Perfect for outdoor activities and areas with limited electricity.",
    price: 65.00,
    quantity: 30,
    country: "South Africa",
    tags: ["solar", "electronics", "sustainable", "charger"],
    images: [
      "https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c",
      "https://images.unsplash.com/photo-1617704548623-340376564e68"
    ],
    sellerEmail: "sa-renew@54links.com",
    categoryName: "Technology",
    subcategoryName: "Gadgets & Accessories",
    generalCategoryName: "Electronics & Technology",
    generalSubcategoryName: "Smart Home Devices",
    industryCategoryName: "Information & Communication Technology (ICT)",
    industrySubcategoryName: "IT Services & Cloud Solutions",
    createdAtDaysAgo: 15,
    audience: {
      categories: ["Technology", "Energy"],
      subcategories: [
        "Technology > Hardware & Devices",
        { category: "Energy", subcategory: "Renewable Energy" }
      ],
      identities: ["Entrepreneurs", "Students", "Professionals"]
    }
  },
  {
    title: "Organic Shea Butter - 250g",
    description: "100% pure and organic shea butter sourced from women's cooperatives in Northern Ghana. Great for skin and hair care.",
    price: 18.00,
    quantity: 100,
    country: "Ghana",
    tags: ["organic", "beauty", "skincare", "natural"],
    images: [
      "https://images.unsplash.com/photo-1598662972299-5408ddb8a3dc",
      "https://images.unsplash.com/photo-1571781565036-d3f759be73e4"
    ],
    sellerEmail: "afri-agro@54links.com",
    categoryName: "Health & Beauty",
    subcategoryName: "Skincare",
    industryCategoryName: "Healthcare & Life Sciences",
    industrySubcategoryName: "Pharmaceuticals & Biotech",
    createdAtDaysAgo: 8,
    audience: {
      categories: ["Health & Beauty", "Trade"],
      subcategories: [
        { category: "Trade", subcategory: "Beauty & Cosmetics" }
      ],
      subsubcategories: [
        "Trade > Beauty & Cosmetics > Skincare"
      ],
      identities: ["Entrepreneurs", "Social Entrepreneurs"]
    }
  },
  {
    title: "Handwoven Basket Set",
    description: "Set of 3 handwoven baskets in different sizes. Made from sustainable materials by skilled artisans.",
    price: 75.00,
    quantity: 20,
    country: "Rwanda",
    tags: ["handwoven", "home decor", "sustainable", "artisan"],
    images: [
      "https://images.unsplash.com/photo-1632164566668-7b0d0c92b10a",
      "https://images.unsplash.com/photo-1611486212557-88be5ff6f941"
    ],
    sellerEmail: "kenya-logistics@54links.com",
    categoryName: "Home & Living",
    subcategoryName: "Home Decor",
    industryCategoryName: "Manufacturing",
    industrySubcategoryName: "Textiles & Apparel",
    createdAtDaysAgo: 12,
    audience: {
      categories: ["Home & Living", "Trade"],
      subcategories: [
        "Home & Living > Home Decor",
        { category: "Trade", subcategory: "Home Goods" }
      ],
      identities: ["Entrepreneurs", "Social Entrepreneurs", "Creative & Artist"]
    }
  }
];

// Service Seeds
const SERVICE_SEEDS = [
  {
    title: "Web Development & E-commerce Solutions",
    serviceType: "Freelance Work",
    description: "Professional web development services specializing in e-commerce solutions for African businesses. Custom designs, payment integration, and mobile optimization.",
    priceAmount: 500.00,
    priceType: "Fixed Price",
    deliveryTime: "2 Weeks",
    locationType: "Remote",
    experienceLevel: "Expert",
    country: "Nigeria",
    city: "Lagos",
    skills: ["React", "Node.js", "E-commerce", "Payment Integration", "UI/UX"],
    attachments: [
      "https://images.unsplash.com/photo-1547658719-da2b51169166",
      "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e"
    ],
    providerEmail: "naija-fintech@54links.com",
    categoryName: "Technology",
    subcategoryName: "Web Development",
    generalCategoryName: "Technology & IT Services",
    generalSubcategoryName: "Web Development",
    industryCategoryName: "Knowledge & Technology",
    industrySubcategoryName: "Information Technology",
    industrySubsubCategoryName: "Software Development",
    createdAtDaysAgo: 3,
    audience: {
      categories: ["Technology", "Service Providers"],
      subcategories: [
        "Technology > Software Development",
        { category: "Service Providers", subcategory: "Consulting" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Freelancers"]
    }
  },
  {
    title: "Business Plan Development & Consulting",
    serviceType: "Consulting",
    description: "Comprehensive business plan development and consulting services for startups and SMEs. Market research, financial projections, and strategic planning.",
    priceAmount: 300.00,
    priceType: "Fixed Price",
    deliveryTime: "1 Week",
    locationType: "Remote",
    experienceLevel: "Expert",
    country: "South Africa",
    city: "Johannesburg",
    skills: ["Business Planning", "Market Research", "Financial Modeling", "Strategy"],
    attachments: [
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
      "https://images.unsplash.com/photo-1552664730-d307ca884978"
    ],
    providerEmail: "sa-renew@54links.com",
    categoryName: "Business",
    subcategoryName: "Consulting & Strategy",
    industryCategoryName: "Financial Services",
    industrySubcategoryName: "Investment & Capital Markets",
    createdAtDaysAgo: 7,
    audience: {
      categories: ["Business", "Service Providers"],
      subcategories: [
        "Business > Consulting & Strategy",
        { category: "Service Providers", subcategory: "Consulting" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Social Entrepreneurs"]
    }
  },
  {
    title: "Logo & Brand Identity Design",
    serviceType: "Freelance Work",
    description: "Professional logo and brand identity design services. Includes logo, color palette, typography, and brand guidelines.",
    priceAmount: 250.00,
    priceType: "Fixed Price",
    deliveryTime: "1 Week",
    locationType: "Remote",
    experienceLevel: "Expert",
    country: "Kenya",
    city: "Nairobi",
    skills: ["Logo Design", "Brand Identity", "Graphic Design", "Adobe Creative Suite"],
    attachments: [
      "https://images.unsplash.com/photo-1626785774573-4b799315345d",
      "https://images.unsplash.com/photo-1634942537034-2531766767d1"
    ],
    providerEmail: "kenya-logistics@54links.com",
    categoryName: "Marketing & Advertising",
    subcategoryName: "Branding & Creative Strategy",
    industryCategoryName: "Services",
    industrySubcategoryName: "Professional Services",
    createdAtDaysAgo: 10,
    audience: {
      categories: ["Marketing & Advertising", "Service Providers"],
      subcategories: [
        "Marketing & Advertising > Branding & Creative Strategy",
        { category: "Service Providers", subcategory: "Creative & Design Services" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Creative & Artist"]
    }
  },
  {
    title: "Agricultural Consulting & Farm Management",
    serviceType: "Consulting",
    description: "Expert agricultural consulting and farm management services. Crop selection, soil analysis, irrigation planning, and yield optimization.",
    priceAmount: 400.00,
    priceType: "Fixed Price",
    deliveryTime: "2 Weeks",
    locationType: "On-site",
    experienceLevel: "Expert",
    country: "Ghana",
    city: "Accra",
    skills: ["Agriculture", "Farm Management", "Crop Planning", "Soil Analysis"],
    attachments: [
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449",
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9"
    ],
    providerEmail: "afri-agro@54links.com",
    categoryName: "Agriculture",
    subcategoryName: "Farming & Crop Production",
    industryCategoryName: "Agriculture & Agribusiness",
    industrySubcategoryName: "Crop Production",
    createdAtDaysAgo: 5,
    audience: {
      categories: ["Agriculture", "Service Providers"],
      subcategories: [
        "Agriculture > Crop Production",
        { category: "Service Providers", subcategory: "Consulting" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Government Officials"]
    }
  },
  {
    title: "Social Media Marketing & Management",
    serviceType: "Freelance Work",
    description: "Comprehensive social media marketing and management services for African businesses. Content creation, scheduling, and analytics.",
    priceAmount: 200.00,
    priceType: "Fixed Price",
    deliveryTime: "1 Month",
    locationType: "Remote",
    experienceLevel: "Intermediate",
    country: "Nigeria",
    city: "Lagos",
    skills: ["Social Media Marketing", "Content Creation", "Analytics", "Strategy"],
    attachments: [
      "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7",
      "https://images.unsplash.com/photo-1611162616475-46b635cb6868"
    ],
    providerEmail: "naija-fintech@54links.com",
    categoryName: "Marketing & Advertising",
    subcategoryName: "Digital Marketing",
    industryCategoryName: "Creative & Cultural Industries",
    industrySubcategoryName: "Media & Broadcasting",
    createdAtDaysAgo: 8,
    audience: {
      categories: ["Marketing & Advertising", "Service Providers"],
      subcategories: [
        "Marketing & Advertising > Digital Marketing",
        { category: "Service Providers", subcategory: "Marketing & Advertising" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Freelancers"]
    }
  }
];

// Tourism Seeds
const TOURISM_SEEDS = [
  {
    postType: "Destination",
    title: "Serengeti National Park Safari Experience",
    description: "Experience the breathtaking wildlife and landscapes of Serengeti National Park. Home to the Great Migration and the Big Five, this is a must-visit destination for nature lovers.",
    country: "Tanzania",
    location: "Serengeti National Park",
    season: "June to October",
    budgetRange: "$1,500 - $3,000",
    tags: ["safari", "wildlife", "nature", "adventure"],
    images: [
      "https://images.unsplash.com/photo-1516426122078-c23e76319801",
      "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e",
      "https://images.unsplash.com/photo-1535941339077-2dd1c7963098"
    ],
    authorEmail: "kenya-logistics@54links.com",
    categoryName: "Tourism & Travel",
    subcategoryName: "Wildlife & Safari",
    generalCategoryName: "Tourist Attractions",
    generalSubcategoryName: "Natural Attractions",
    generalSubsubCategoryName: "National Parks & Reserves",
    industryCategoryName: "Hospitality & Tourism",
    industrySubcategoryName: "Hotels & Resorts",
    createdAtDaysAgo: 4,
    audience: {
      categories: ["Tourism & Travel"],
      subcategories: [
        "Tourism & Travel > Wildlife & Safari"
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Professionals", "Investors"]
    }
  },
  {
    postType: "Experience",
    title: "Cape Winelands Tour - South Africa's Premier Wine Region",
    description: "Discover South Africa's world-renowned wine region with this guided tour of the Cape Winelands. Visit top wineries, enjoy wine tastings, and experience the beautiful landscapes.",
    country: "South Africa",
    location: "Stellenbosch, Franschhoek, Paarl",
    season: "Year-round (best September to April)",
    budgetRange: "$100 - $300",
    tags: ["wine", "food", "culture", "scenic"],
    images: [
      "https://images.unsplash.com/photo-1566903451935-7e8835131e97",
      "https://images.unsplash.com/photo-1504279577054-acfeccf8fc52",
      "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb"
    ],
    authorEmail: "sa-renew@54links.com",
    categoryName: "Tourism & Travel",
    subcategoryName: "Food & Wine",
    industryCategoryName: "Hospitality & Tourism",
    industrySubcategoryName: "Travel Agencies",
    createdAtDaysAgo: 7,
    audience: {
      categories: ["Tourism & Travel"],
      subcategories: [
        "Tourism & Travel > Food & Wine"
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Professionals", "Creative & Artist"]
    }
  },
  {
    postType: "Culture",
    title: "Maasai Cultural Experience - Traditional Village Visit",
    description: "Immerse yourself in the rich culture of the Maasai people with a visit to a traditional village. Learn about their customs, traditions, and way of life directly from community members.",
    country: "Kenya",
    location: "Maasai Mara Region",
    season: "Year-round",
    budgetRange: "$50 - $150",
    tags: ["culture", "indigenous", "tradition", "community"],
    images: [
      "https://images.unsplash.com/photo-1489493585363-d69421e0edd3",
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5",
      "https://images.unsplash.com/photo-1523805009345-7448845a9e53"
    ],
    authorEmail: "kenya-logistics@54links.com",
    categoryName: "Tourism & Travel",
    subcategoryName: "Cultural Tourism",
    industryCategoryName: "Hospitality & Tourism",
    industrySubcategoryName: "Hotels & Resorts",
    createdAtDaysAgo: 10,
    audience: {
      categories: ["Tourism & Travel"],
      subcategories: [
        "Tourism & Travel > Cultural Tourism"
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Social Entrepreneurs", "Creative & Artist"]
    }
  },
  {
    postType: "Destination",
    title: "Victoria Falls - The Smoke That Thunders",
    description: "Experience the majestic Victoria Falls, one of the Seven Natural Wonders of the World. Enjoy breathtaking views, adventure activities, and the rich biodiversity of the surrounding area.",
    country: "Zimbabwe/Zambia",
    location: "Victoria Falls",
    season: "February to May (highest flow)",
    budgetRange: "$500 - $1,000",
    tags: ["waterfall", "adventure", "nature", "UNESCO"],
    images: [
      "https://images.unsplash.com/photo-1609198092458-38a293c7ac4b",
      "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5",
      "https://images.unsplash.com/photo-1565622871630-8e818e5bd4a6"
    ],
    authorEmail: "sa-renew@54links.com",
    categoryName: "Tourism & Travel",
    subcategoryName: "Natural Wonders",
    industryCategoryName: "Hospitality & Tourism",
    industrySubcategoryName: "Hotels & Resorts",
    createdAtDaysAgo: 15,
    audience: {
      categories: ["Tourism & Travel"],
      subcategories: [
        "Tourism & Travel > Natural Wonders"
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Professionals", "Students"]
    }
  },
  {
    postType: "Experience",
    title: "Atlas Mountains Trekking Adventure",
    description: "Embark on an unforgettable trekking adventure in Morocco's Atlas Mountains. Experience breathtaking landscapes, traditional Berber villages, and the highest peak in North Africa.",
    country: "Morocco",
    location: "Atlas Mountains",
    season: "April to October",
    budgetRange: "$300 - $800",
    tags: ["trekking", "mountains", "adventure", "culture"],
    images: [
      "https://images.unsplash.com/photo-1528834342297-fdefb9a5a92b",
      "https://images.unsplash.com/photo-1518005068251-37900150dfca",
      "https://images.unsplash.com/photo-1504609813442-a8924e83f76e"
    ],
    authorEmail: "naija-fintech@54links.com",
    categoryName: "Tourism & Travel",
    subcategoryName: "Adventure Tourism",
    industryCategoryName: "Hospitality & Tourism",
    industrySubcategoryName: "Hotels & Resorts",
    industrySubsubCategoryName: "Tour Operators",
    createdAtDaysAgo: 9,
    audience: {
      categories: ["Tourism & Travel"],
      subcategories: [
        "Tourism & Travel > Adventure Tourism"
      ],
      identities: ["Entrepreneurs", "Professionals", "Students", "Sports Professionals"]
    }
  }
];

// Funding Seeds
const FUNDING_SEEDS = [
  {
    title: "Sustainable Agriculture Technology for Small-Scale Farmers",
    pitch: "We're developing affordable, solar-powered irrigation systems for small-scale farmers across East Africa. Our technology increases crop yields by 40% while reducing water usage by 60%.",
    goal: 50000.00,
    raised: 15000.00,
    currency: "USD",
    deadline: daysAgo(-60),
    country: "Kenya",
    city: "Nairobi",
    rewards: "Backers will receive regular impact reports, recognition on our website, and early access to our technology depending on contribution level.",
    team: "Our team consists of agricultural engineers, solar energy experts, and rural development specialists with over 20 years of combined experience.",
    email: "contact@agritech.co.ke",
    phone: "+254712345678",
    status: "published",
    visibility: "public",
    tags: ["agriculture", "solar", "irrigation", "sustainability"],
    links: ["https://agritech.co.ke", "https://twitter.com/agritech"],
    images: [
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9",
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449",
      "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8"
    ],
    creatorEmail: "afri-agro@54links.com",
    categoryName: "Agriculture",
    generalCategoryName: "Grants",
    generalSubcategoryName: "Innovation & Startup Funding",
    generalSubsubCategoryName: "Seed Funding",
    industryCategoryName: "Agriculture",
    industrySubcategoryName: "Agricultural Technology (AgriTech)",
    createdAtDaysAgo: 5,
    audience: {
      categories: ["Agriculture", "Energy"],
      subcategories: [
        "Agriculture > Crop Production",
        { category: "Energy", subcategory: "Renewable Energy" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Investors", "Social Entrepreneurs"]
    }
  },
  {
    title: "Mobile Health Clinic for Rural Communities",
    pitch: "We're launching a fleet of mobile health clinics to provide essential healthcare services to underserved rural communities in Nigeria. Each clinic can serve up to 500 patients per week.",
    goal: 75000.00,
    raised: 25000.00,
    currency: "USD",
    deadline: daysAgo(-90),
    country: "Nigeria",
    city: "Lagos",
    rewards: "Backers will receive impact reports, recognition on our clinic vehicles, and invitations to our launch events based on contribution level.",
    team: "Our team includes medical professionals, public health experts, and logistics specialists committed to improving healthcare access.",
    email: "info@mobilehealth.ng",
    phone: "+2349012345678",
    status: "published",
    visibility: "public",
    tags: ["healthcare", "mobile clinic", "rural", "community"],
    links: ["https://mobilehealth.ng", "https://instagram.com/mobilehealth"],
    images: [
      "https://images.unsplash.com/photo-1584982751601-97dcc096659c",
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef",
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118"
    ],
    creatorEmail: "naija-fintech@54links.com",
    categoryName: "Healthcare",
    industryCategoryName: "Healthcare & Life Sciences",
    industrySubcategoryName: "Hospitals & Clinics",
    createdAtDaysAgo: 10,
    audience: {
      categories: ["Healthcare"],
      subcategories: [
        { category: "Healthcare", subcategory: "Health & Wellbeing" }
      ],
      identities: ["Entrepreneurs", "Social Entrepreneurs", "Investors", "Government Officials"]
    }
  },
  {
    title: "Renewable Energy Microgrids for Off-Grid Communities",
    pitch: "We're building solar-powered microgrids to provide clean, reliable electricity to off-grid communities in South Africa. Our solution is 30% more affordable than traditional grid extensions.",
    goal: 100000.00,
    raised: 40000.00,
    currency: "USD",
    deadline: daysAgo(-120),
    country: "South Africa",
    city: "Cape Town",
    rewards: "Backers will receive regular project updates, recognition on our installations, and community impact reports based on contribution level.",
    team: "Our team consists of renewable energy engineers, community development specialists, and financial experts with extensive experience in off-grid solutions.",
    email: "projects@cleanenergy.co.za",
    phone: "+27821234567",
    status: "published",
    visibility: "public",
    tags: ["renewable energy", "solar", "microgrid", "off-grid"],
    links: ["https://cleanenergy.co.za", "https://linkedin.com/company/cleanenergy"],
    images: [
      "https://images.unsplash.com/photo-1509391366360-2e959784a276",
      "https://images.unsplash.com/photo-1497440001374-f26997328c1b",
      "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e"
    ],
    creatorEmail: "sa-renew@54links.com",
    categoryName: "Energy",
    subcategoryName: "Renewable Energy (Solar, Wind, Hydro)",
    industryCategoryName: "Energy & Utilities",
    industrySubcategoryName: "Renewable Energy (Solar, Wind, Hydro)",
    createdAtDaysAgo: 15,
    audience: {
      categories: ["Energy"],
      subcategories: [
        { category: "Energy", subcategory: "Renewable Energy" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Investors", "Government Officials"]
    }
  },
  {
    title: "Educational Technology for Rural Schools",
    pitch: "We're developing low-cost, solar-powered tablets preloaded with educational content for students in rural schools across Ghana. Our solution works offline and includes teacher training.",
    goal: 60000.00,
    raised: 20000.00,
    currency: "USD",
    deadline: daysAgo(-75),
    country: "Ghana",
    city: "Accra",
    rewards: "Backers will receive impact reports, recognition in our materials, and opportunities to connect with beneficiary schools based on contribution level.",
    team: "Our team includes educators, software developers, and education policy experts committed to improving access to quality education.",
    email: "info@edutechghana.org",
    phone: "+233201234567",
    status: "published",
    visibility: "public",
    tags: ["education", "technology", "rural", "tablets"],
    links: ["https://edutechghana.org", "https://facebook.com/edutechghana"],
    images: [
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b",
      "https://images.unsplash.com/photo-1588072432836-e10032774350",
      "https://images.unsplash.com/photo-1497633762265-9d179a990aa6"
    ],
    creatorEmail: "afri-agro@54links.com",
    categoryName: "Education",
    industryCategoryName: "Services",
    industrySubcategoryName: "Education & Training",
    createdAtDaysAgo: 8,
    audience: {
      categories: ["Education", "Technology"],
      subcategories: [
        { category: "Education", subcategory: "Education & Skill Development" },
        { category: "Technology", subcategory: "Software Development" }
      ],
      identities: ["Entrepreneurs", "Social Entrepreneurs", "Investors", "Government Officials"]
    }
  },
  {
    title: "Sustainable Fashion Brand Using African Textiles",
    pitch: "We're launching a sustainable fashion brand that combines traditional African textiles with modern designs. Our products are ethically produced by local artisans, supporting fair wages and cultural preservation.",
    goal: 40000.00,
    raised: 15000.00,
    currency: "USD",
    deadline: daysAgo(-45),
    country: "Kenya",
    city: "Nairobi",
    rewards: "Backers will receive limited edition products, behind-the-scenes access, and recognition on our website based on contribution level.",
    team: "Our team includes fashion designers, textile experts, and business professionals with a passion for sustainable fashion and African heritage.",
    email: "hello@afrifashion.co.ke",
    phone: "+254712345678",
    status: "published",
    visibility: "public",
    tags: ["fashion", "sustainable", "textiles", "artisan"],
    links: ["https://afrifashion.co.ke", "https://instagram.com/afrifashion"],
    images: [
      "https://images.unsplash.com/photo-1534137667199-675a46e143f3",
      "https://images.unsplash.com/photo-1589891685391-c1c1a2c4f1df",
      "https://images.unsplash.com/photo-1509319117193-57bab727e09d"
    ],
    creatorEmail: "kenya-logistics@54links.com",
    categoryName: "Fashion & Apparel",
    industryCategoryName: "Manufacturing",
    industrySubcategoryName: "Textiles & Apparel",
    createdAtDaysAgo: 12,
    audience: {
      categories: ["Fashion & Apparel", "Trade"],
      subcategories: [
        { category: "Fashion & Apparel", subcategory: "Textiles" },
        { category: "Trade", subcategory: "Fashion" }
      ],
      identities: ["Entrepreneurs", "Social Entrepreneurs", "Creative & Artist", "Investors"]
    }
  }
];

// Event Seeds
const EVENT_SEEDS = [
  {
    title: "African Tech Summit",
    eventType: "Conference",
    description: "Annual conference bringing together tech leaders, startups, and investors from across Africa to discuss innovation, investment, and growth in the African tech ecosystem.",
    startDate: daysAgo(-30),
    endDate: daysAgo(-32),
    location: "Kigali Convention Center",
    address: "KG 2 Roundabout, Kigali, Rwanda",
    country: "Rwanda",
    city: "Kigali",
    virtual: false,
    price: 250.00,
    currency: "USD",
    startAt: new Date().toISOString().split('T')[0],
    endAt: new Date().toISOString().split('T')[0],
    locationType: 'Virtual',
    capacity: 500,
    tags: ["technology", "innovation", "startups", "investment"],
    images: [
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87",
      "https://images.unsplash.com/photo-1515187029135-18ee286d815b"
    ],
    organizerEmail: "kenya-logistics@54links.com",
    categoryName: "Technology",
    subcategoryName: "Tech Events",
    generalCategoryName: "Technology & Innovation",
    generalSubcategoryName: "Developer Meetups",
    industryCategoryName: "Knowledge & Technology",
    industrySubcategoryName: "Information Technology",
    createdAtDaysAgo: 60,
    audience: {
      categories: ["Technology", "Business"],
      subcategories: [
        { category: "Technology", subcategory: "Software Development" },
        { category: "Business", subcategory: "Entrepreneurship" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Investors", "Professionals"]
    },
    coverImageUrl: "https://img.freepik.com/free-photo/professional-team-analyzing-archived-data-financial-file-meeting_482257-114412.jpg"
  },
  {
    title: "Pan-African Agricultural Innovation Forum",
    eventType: "Conference",
    description: "A forum focused on agricultural innovation, sustainable farming practices, and technology adoption in African agriculture. Connect with experts, policymakers, and agribusiness leaders.",
    startDate: daysAgo(-45),
    endDate: daysAgo(-47),
    location: "Radisson Blu Hotel",
    address: "Elgon Avenue, Upper Hill, Nairobi, Kenya",
    country: "Kenya",
    city: "Nairobi",
    startAt: new Date().toISOString().split('T')[0],
    endAt: new Date().toISOString().split('T')[0],
    locationType: 'Virtual',
    virtual: false,
    price: 150.00,
    currency: "USD",
    capacity: 300,
    tags: ["agriculture", "innovation", "sustainability", "agritech"],
    images: [
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9",
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449"
    ],
    organizerEmail: "afri-agro@54links.com",
    categoryName: "Agriculture",
    subcategoryName: "Agricultural Technology",
    industryCategoryName: "Agriculture",
    industrySubcategoryName: "Agricultural Technology (AgriTech)",
    createdAtDaysAgo: 75,
    audience: {
      categories: ["Agriculture", "Technology"],
      subcategories: [
        { category: "Agriculture", subcategory: "Crop Production" },
        { category: "Technology", subcategory: "AgriTech" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Government Officials", "Investors"]
    },
    coverImageUrl: "https://img.freepik.com/free-photo/photorealistic-woman-organic-sustainable-garden-harvesting-produce_23-2151463029.jpg"
  },
  {
    title: "African Renewable Energy Summit",
    eventType: "Conference",
    description: "Summit focused on renewable energy development in Africa. Discuss policy, investment, and technology for solar, wind, hydro, and other renewable energy sources.",
    startDate: daysAgo(-60),
    endDate: daysAgo(-62),
    location: "Cape Town International Convention Centre",
    address: "Convention Square, 1 Lower Long Street, Cape Town, South Africa",
    country: "South Africa",
    city: "Cape Town",
    virtual: true,
    price: 200.00,
    currency: "USD",
    startAt: new Date().toISOString().split('T')[0],
    endAt: new Date().toISOString().split('T')[0],
    locationType: 'Virtual',
    capacity: 400,
    tags: ["renewable energy", "solar", "wind", "sustainability"],
    images: [
      "https://images.unsplash.com/photo-1509391366360-2e959784a276",
      "https://images.unsplash.com/photo-1497440001374-f26997328c1b"
    ],
    organizerEmail: "sa-renew@54links.com",
    categoryName: "Energy",
    subcategoryName: "Renewable Energy",
    industryCategoryName: "Energy & Utilities",
    industrySubcategoryName: "Renewable Energy (Solar, Wind, Hydro)",
    createdAtDaysAgo: 90,
    audience: {
      categories: ["Energy", "Business"],
      subcategories: [
        { category: "Energy", subcategory: "Renewable Energy" },
        { category: "Business", subcategory: "Investment" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Investors", "Government Officials"]
    },
    coverImageUrl: "https://img.freepik.com/premium-photo/high-angle-view-buildings-trees-city_1048944-8253395.jpg"
  },
  {
    title: "African Fashion Week",
    eventType: "Networking",
    description: "Showcase of African fashion, textiles, and design. Connect with designers, retailers, and fashion industry professionals from across the continent.",
    startDate: daysAgo(-20),
    endDate: daysAgo(-26),
    location: "Eko Hotel & Suites",
    address: "Plot 1415 Adetokunbo Ademola Street, Victoria Island, Lagos, Nigeria",
    country: "Nigeria",
    city: "Lagos",
    startAt: new Date().toISOString().split('T')[0],
    endAt: new Date().toISOString().split('T')[0],
    locationType: 'Virtual',
    virtual: false,
    price: 100.00,
    currency: "USD",
    capacity: 1000,
    tags: ["fashion", "design", "textiles", "culture"],
    images: [
      "https://images.unsplash.com/photo-1534137667199-675a46e143f3",
      "https://images.unsplash.com/photo-1589891685391-c1c1a2c4f1df"
    ],
    organizerEmail: "naija-fintech@54links.com",
    categoryName: "Fashion & Apparel",
    subcategoryName: "Fashion Events",
    industryCategoryName: "Manufacturing",
    industrySubcategoryName: "Textiles & Apparel",
    createdAtDaysAgo: 120,
    audience: {
      categories: ["Fashion & Apparel", "Trade"],
      subcategories: [
        { category: "Fashion & Apparel", subcategory: "Textiles" },
        { category: "Trade", subcategory: "Fashion" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Creative & Artist", "Investors"]
    },
    coverImageUrl: "https://img.freepik.com/stock-photo/representations-user-experience-interface-design_23-2150038909.jpg"
  },
  {
    title: "African Healthcare Innovation Conference",
    eventType: "Conference",
    description: "Conference focused on healthcare innovation, telemedicine, and medical technology in Africa. Connect with healthcare professionals, startups, and investors.",
    startDate: daysAgo(-75),
    endDate: daysAgo(-77),
    location: "Accra International Conference Centre",
    address: "Castle Road, Accra, Ghana",
    country: "Ghana",
    startAt: new Date().toISOString().split('T')[0],
    endAt: new Date().toISOString().split('T')[0],
    locationType: 'Virtual',
    city: "Accra",
    virtual: true,
    price: 180.00,
    currency: "USD",
    capacity: 350,
    tags: ["healthcare", "innovation", "telemedicine", "medical technology"],
    images: [
      "https://images.unsplash.com/photo-1584982751601-97dcc096659c",
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef"
    ],
    organizerEmail: "afri-agro@54links.com",
    categoryName: "Healthcare",
    subcategoryName: "Health Technology",
    industryCategoryName: "Healthcare & Life Sciences",
    industrySubcategoryName: "Hospitals & Clinics",
    createdAtDaysAgo: 100,
    audience: {
      categories: ["Healthcare", "Technology"],
      subcategories: [
        { category: "Healthcare", subcategory: "Health & Wellbeing" },
        { category: "Technology", subcategory: "Health Tech" }
      ],
      identities: ["Entrepreneurs", "Business Owners / Businesses", "Professionals", "Investors"]
    },
    coverImageUrl: "https://img.freepik.com/free-photo/woman-using-ai-llm-greets-friend-videocall-green-screen-phone_482257-127297.jpg"
  }
];

// Job Seeds
const JOB_SEEDS = [
  {
    title: "Senior Software Engineer - Fintech",
    workMode:'Hybrid',
    jobType: "Full-time",
    description: "We're looking for a Senior Software Engineer to join our fintech team in Lagos. You'll be responsible for developing and maintaining our payment processing platform, working with modern technologies like Node.js, React, and AWS.",
    requirements: "5+ years of experience in software development, strong knowledge of JavaScript/TypeScript, experience with Node.js and React, familiarity with AWS services, understanding of payment systems.",
    responsibilities: "Design and implement new features, maintain existing codebase, collaborate with product and design teams, mentor junior developers, participate in code reviews.",
    salary: "Competitive",
    location: "Lagos, Nigeria",
    remote: true,
    country:'Nigeria',
    companyName: "AfriPay Solutions", 
    applicationDeadline: daysAgo(-30),
    tags: ["software engineering", "fintech", "node.js", "react", "aws"],
    postedByEmail: "naija-fintech@54links.com",
    categoryName: "Technology",
    subcategoryName: "Software Development",
    industryCategoryName: "Information & Communication Technology (ICT)",
    industrySubcategoryName: "Software & App Development",
    createdAtDaysAgo: 5,
    audience: {
      categories: ["Technology", "Finance"],
      subcategories: [
        { category: "Technology", subcategory: "Software Development" },
        { category: "Finance", subcategory: "Financial Technology" }
      ],
      identities: ["Professionals", "Freelancers", "Students"]
    },
    coverImageBase64: "https://img.freepik.com/free-photo/business-executives-participating-business-meeting_107420-63841.jpg"
  },
  {
    title: "Agricultural Project Manager",
    jobType: "Full-time",
    workMode:'Hybrid',
    description: "We're seeking an experienced Agricultural Project Manager to oversee our sustainable farming initiatives across East Africa. You'll be responsible for planning, implementing, and monitoring agricultural projects, working with local farmers and stakeholders.",
    requirements: "Bachelor's degree in Agriculture, Project Management, or related field, 3+ years of experience in agricultural project management, knowledge of sustainable farming practices, excellent communication and leadership skills.",
    responsibilities: "Develop project plans, coordinate with local farmers and stakeholders, monitor project progress, prepare reports, ensure compliance with regulations and standards.",
    salary: "$40,000 - $60,000 per year",
    location: "Nairobi, Kenya",
    country:'Kenya',
    remote: false,
    companyName: "EastAfrica AgriDev",
    applicationDeadline: daysAgo(-45),
    tags: ["agriculture", "project management", "sustainable farming", "east africa"],
    postedByEmail: "afri-agro@54links.com",
    categoryName: "Agriculture",
    subcategoryName: "Agricultural Management",
    industryCategoryName: "Agriculture & Agribusiness",
    industrySubcategoryName: "Agro-processing",
    createdAtDaysAgo: 10,
    audience: {
      categories: ["Agriculture", "Project Management"],
      subcategories: [
        { category: "Agriculture", subcategory: "Crop Production" },
        { category: "Project Management", subcategory: "Agricultural Projects" }
      ],
      identities: ["Professionals", "Business Owners / Businesses", "Government Officials"]
    },
    coverImageBase64: "https://img.freepik.com/free-photo/photorealistic-woman-organic-sustainable-garden-harvesting-produce_23-2151463029.jpg"
  },
  {
    title: "Renewable Energy Engineer",
    jobType: "Full-time",
    workMode:'Hybrid',
    country: "South Africa",
    description: "We're looking for a Renewable Energy Engineer to join our team in Cape Town. You'll be responsible for designing, implementing, and maintaining solar and wind energy systems for off-grid communities across Southern Africa.",
    requirements: "Bachelor's degree in Electrical Engineering, Renewable Energy, or related field, 2+ years of experience in renewable energy projects, knowledge of solar and wind energy systems, experience with energy storage solutions.",
    responsibilities: "Design renewable energy systems, conduct site assessments, oversee installation and maintenance, train local technicians, prepare technical reports.",
    salary: "R400,000 - R600,000 per year",
    location: "Cape Town, South Africa",
    remote: false,
    companyName: "SolarWindAfrica",
    applicationDeadline: daysAgo(-60),
    tags: ["renewable energy", "solar", "wind", "engineering", "off-grid"],
    postedByEmail: "sa-renew@54links.com",
    categoryName: "Energy",
    subcategoryName: "Renewable Energy",
    industryCategoryName: "Energy & Utilities",
    industrySubcategoryName: "Renewable Energy (Solar, Wind, Hydro)",
    createdAtDaysAgo: 15,
    audience: {
      categories: ["Energy", "Engineering"],
      subcategories: [
        { category: "Energy", subcategory: "Renewable Energy" },
        { category: "Engineering", subcategory: "Electrical Engineering" }
      ],
      identities: ["Professionals", "Students", "Business Owners / Businesses"]
    },
    coverImageBase64: "https://img.freepik.com/premium-photo/high-angle-view-buildings-trees-city_1048944-8253395.jpg"
  },
  {
    title: "Marketing Manager - Fashion Brand",
    jobType: "Full-time",
    workMode:'Hybrid',
    description: "We're seeking a creative and strategic Marketing Manager to lead our marketing efforts for our sustainable fashion brand. You'll be responsible for developing and implementing marketing strategies to increase brand awareness and drive sales across Africa.",
    requirements: "Bachelor's degree in Marketing, Business, or related field, 3+ years of experience in fashion marketing, knowledge of digital marketing channels, experience with social media marketing, understanding of the African fashion market.",
    responsibilities: "Develop marketing strategies, manage social media presence, coordinate with influencers and partners, analyze marketing performance, manage marketing budget.",
    salary: "Competitive",
    location: "Nairobi, Kenya",
    country: "South Kenya",
    remote: true,
    companyName: "AfriStyle Collective",
    applicationDeadline: daysAgo(-30),
    tags: ["marketing", "fashion", "social media", "digital marketing"],
    postedByEmail: "kenya-logistics@54links.com",
    categoryName: "Marketing & Advertising",
    subcategoryName: "Digital Marketing",
    industryCategoryName: "Services",
    industrySubcategoryName: "Media, Entertainment & Sports",
    createdAtDaysAgo: 7,
    audience: {
      categories: ["Marketing & Advertising", "Fashion & Apparel"],
      subcategories: [
        { category: "Marketing & Advertising", subcategory: "Digital Marketing" },
        { category: "Fashion & Apparel", subcategory: "Fashion Marketing" }
      ],
      identities: ["Professionals", "Creative & Artist", "Freelancers"]
    },
    coverImageBase64: "https://img.freepik.com/free-photo/representations-user-experience-interface-design_23-2150038909.jpg"
  },
  {
    title: "Healthcare Technology Consultant",
    jobType: "Contract",
    workMode:'Hybrid',
    description: "We're looking for a Healthcare Technology Consultant to help healthcare providers across West Africa implement telemedicine and electronic health record systems. You'll work with hospitals, clinics, and healthcare startups to improve their technology infrastructure.",
    requirements: "Bachelor's degree in Healthcare Administration, Information Technology, or related field, 3+ years of experience in healthcare technology, knowledge of telemedicine platforms and EHR systems, excellent consulting and communication skills.",
    responsibilities: "Assess client needs, recommend technology solutions, develop implementation plans, train staff, provide ongoing support and guidance.",
    salary: "$300 - $500 per day",
    location: "Accra, Ghana",
    remote: true,
    country: "Ghana",
    companyName: "WestAfrica HealthTech Consulting",
    applicationDeadline: daysAgo(-45),
    tags: ["healthcare", "technology", "telemedicine", "consulting", "EHR"],
    postedByEmail: "afri-agro@54links.com",
    categoryName: "Healthcare",
    subcategoryName: "Health Technology",
    industryCategoryName: "Healthcare & Life Sciences",
    industrySubcategoryName: "Medical Equipment",
    createdAtDaysAgo: 12,
    audience: {
      categories: ["Healthcare", "Technology"],
      subcategories: [
        { category: "Healthcare", subcategory: "Health & Wellbeing" },
        { category: "Technology", subcategory: "Health Tech" }
      ],
      identities: ["Professionals", "Freelancers", "Business Owners / Businesses"]
    },
    coverImageBase64: "https://img.freepik.com/free-photo/woman-using-ai-llm-greets-friend-videocall-green-screen-phone_482257-127297.jpg"
  }
];

/** ------------------------- Main ------------------------- **/

async function run(){
  try {
    await sequelize.authenticate();
    console.log("🔌 DB connected (seed products/services/tourism/funding).");

    // --- Seed Products ---
    const productCount = await Product.count();
    
    for (const p of PRODUCT_SEEDS) {
      if (productCount > 0) {
        console.log(`👥 Products already exist (${productCount}), skipping product seed.`);
        break;
      }
      
      const sellerUserId = await getUserIdByEmail(p.sellerEmail);
      const cat = await upsertCategoryByName(p.categoryName);
      const sub = p.subcategoryName
        ? await upsertSubcategoryByName(p.categoryName, p.subcategoryName)
        : null;

      // Handle general categories for products
      let generalCat = null;
      let generalSub = null;
      let generalSubsub = null;

      if (p.generalCategoryName) {
        generalCat = await upsertGeneralCategoryByName(p.generalCategoryName, 'product');
        if (p.generalSubcategoryName) {
          generalSub = await upsertGeneralSubcategoryByName(p.generalCategoryName, p.generalSubcategoryName, 'product');
          if (p.generalSubsubCategoryName) {
            generalSubsub = await upsertGeneralSubsubCategoryByName(p.generalCategoryName, p.generalSubcategoryName, p.generalSubsubCategoryName, 'product');
          }
        }
      }

      // Handle industry categories for products
      let industryCat = null;
      let industrySub = null;
      let industrySubsub = null;

      if (p.industryCategoryName) {
        industryCat = await upsertIndustryCategoryByName(p.industryCategoryName);
        if (p.industrySubcategoryName) {
          industrySub = await upsertIndustrySubcategoryByName(p.industryCategoryName, p.industrySubcategoryName);
          if (p.industrySubsubCategoryName) {
            industrySubsub = await upsertIndustrySubsubCategoryByName(p.industryCategoryName, p.industrySubcategoryName, p.industrySubsubCategoryName);
          }
        }
      }

      const [product, created] = await Product.findOrCreate({
        where: {
          title: p.title,
          sellerUserId: sellerUserId,
        },
        defaults: {
          description: p.description,
          price: p.price || null,
          quantity: p.quantity || null,
          country: p.country || null,
          tags: p.tags || [],
          images: p.images || [],
          sellerUserId,
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          generalCategoryId: generalCat ? generalCat.id : null,
          generalSubcategoryId: generalSub ? generalSub.id : null,
          generalSubsubCategoryId: generalSubsub ? generalSubsub.id : null,
          industryCategoryId: industryCat ? industryCat.id : null,
          industrySubcategoryId: industrySub ? industrySub.id : null,
          industrySubsubCategoryId: industrySubsub ? industrySubsub.id : null,
          createdAt: daysAgo(p.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Product: ${p.title}`);
      
      if (created && p.audience) {
        await associateWithAudience(product, 'product', p.audience);
        console.log(`   ↳ Associated product with audience data`);
      }
    }

    // --- Seed Services ---
    const serviceCount = await Service.count();
    
    for (const s of SERVICE_SEEDS) {
      if (serviceCount > 0) {
        console.log(`👥 Services already exist (${serviceCount}), skipping service seed.`);
        break;
      }
      
      const providerUserId = await getUserIdByEmail(s.providerEmail);
      const cat = await upsertCategoryByName(s.categoryName);
      const sub = s.subcategoryName
        ? await upsertSubcategoryByName(s.categoryName, s.subcategoryName)
        : null;

      // Handle general categories for services
      let generalCat = null;
      let generalSub = null;
      let generalSubsub = null;

      if (s.generalCategoryName) {
        generalCat = await upsertGeneralCategoryByName(s.generalCategoryName, 'service');
        if (s.generalSubcategoryName) {
          generalSub = await upsertGeneralSubcategoryByName(s.generalCategoryName, s.generalSubcategoryName, 'service');
          if (s.generalSubsubCategoryName) {
            generalSubsub = await upsertGeneralSubsubCategoryByName(s.generalCategoryName, s.generalSubcategoryName, s.generalSubsubCategoryName, 'service');
          }
        }
      }

      // Handle industry categories for services
      let industryCat = null;
      let industrySub = null;
      let industrySubsub = null;

      if (s.industryCategoryName) {
        industryCat = await upsertIndustryCategoryByName(s.industryCategoryName);
        if (s.industrySubcategoryName) {
          industrySub = await upsertIndustrySubcategoryByName(s.industryCategoryName, s.industrySubcategoryName);
          if (s.industrySubsubCategoryName) {
            industrySubsub = await upsertIndustrySubsubCategoryByName(s.industryCategoryName, s.industrySubcategoryName, s.industrySubsubCategoryName);
          }
        }
      }

      const [service, created] = await Service.findOrCreate({
        where: {
          title: s.title,
          providerUserId: providerUserId,
        },
        defaults: {
          serviceType: s.serviceType,
          description: s.description,
          priceAmount: s.priceAmount || null,
          priceType: s.priceType,
          deliveryTime: s.deliveryTime,
          locationType: s.locationType,
          experienceLevel: s.experienceLevel,
          country: s.country || null,
          city: s.city || null,
          skills: s.skills || [],
          attachments: s.attachments || [],
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          generalCategoryId: generalCat ? generalCat.id : null,
          generalSubcategoryId: generalSub ? generalSub.id : null,
          generalSubsubCategoryId: generalSubsub ? generalSubsub.id : null,
          industryCategoryId: industryCat ? industryCat.id : null,
          industrySubcategoryId: industrySub ? industrySub.id : null,
          industrySubsubCategoryId: industrySubsub ? industrySubsub.id : null,
          createdAt: daysAgo(s.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Service: ${s.title}`);
      
      if (created && s.audience) {
        await associateWithAudience(service, 'service', s.audience);
        console.log(`   ↳ Associated service with audience data`);
      }
    }

    // --- Seed Tourism ---
    const tourismCount = await Tourism.count();
    
    for (const t of TOURISM_SEEDS) {
      if (tourismCount > 0) {
        console.log(`👥 Tourism posts already exist (${tourismCount}), skipping tourism seed.`);
        break;
      }
      
      const authorUserId = await getUserIdByEmail(t.authorEmail);
      const cat = await upsertCategoryByName(t.categoryName);
      const sub = t.subcategoryName
        ? await upsertSubcategoryByName(t.categoryName, t.subcategoryName)
        : null;

      // Handle general categories for tourism
      let generalCat = null;
      let generalSub = null;
      let generalSubsub = null;

      if (t.generalCategoryName) {
        generalCat = await upsertGeneralCategoryByName(t.generalCategoryName, 'tourism');
        if (t.generalSubcategoryName) {
          generalSub = await upsertGeneralSubcategoryByName(t.generalCategoryName, t.generalSubcategoryName, 'tourism');
          if (t.generalSubsubCategoryName) {
            generalSubsub = await upsertGeneralSubsubCategoryByName(t.generalCategoryName, t.generalSubcategoryName, t.generalSubsubCategoryName, 'tourism');
          }
        }
      }

      // Handle industry categories for tourism
      let industryCat = null;
      let industrySub = null;
      let industrySubsub = null;

      if (t.industryCategoryName) {
        industryCat = await upsertIndustryCategoryByName(t.industryCategoryName);
        if (t.industrySubcategoryName) {
          industrySub = await upsertIndustrySubcategoryByName(t.industryCategoryName, t.industrySubcategoryName);
          if (t.industrySubsubCategoryName) {
            industrySubsub = await upsertIndustrySubsubCategoryByName(t.industryCategoryName, t.industrySubcategoryName, t.industrySubsubCategoryName);
          }
        }
      }

      const [tourism, created] = await Tourism.findOrCreate({
        where: {
          title: t.title,
          authorUserId: authorUserId,
        },
        defaults: {
          postType: t.postType,
          description: t.description,
          country: t.country,
          location: t.location || null,
          season: t.season || null,
          budgetRange: t.budgetRange || null,
          tags: t.tags || [],
          images: t.images || [],
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          generalCategoryId: generalCat ? generalCat.id : null,
          generalSubcategoryId: generalSub ? generalSub.id : null,
          generalSubsubCategoryId: generalSubsub ? generalSubsub.id : null,
          industryCategoryId: industryCat ? industryCat.id : null,
          industrySubcategoryId: industrySub ? industrySub.id : null,
          industrySubsubCategoryId: industrySubsub ? industrySubsub.id : null,
          createdAt: daysAgo(t.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Tourism: ${t.title}`);
      
      if (created && t.audience) {
        await associateWithAudience(tourism, 'tourism', t.audience);
        console.log(`   ↳ Associated tourism with audience data`);
      }
    }

    // --- Seed Funding ---
    const fundingCount = await Funding.count();
    
    for (const f of FUNDING_SEEDS) {
      if (fundingCount > 0) {
        console.log(`👥 Funding projects already exist (${fundingCount}), skipping funding seed.`);
        break;
      }
      
      const creatorUserId = await getUserIdByEmail(f.creatorEmail);
      const cat = await upsertCategoryByName(f.categoryName);
      const sub = f.subcategoryName
        ? await upsertSubcategoryByName(f.categoryName, f.subcategoryName)
        : null;

      // Handle general categories for funding
      let generalCat = null;
      let generalSub = null;
      let generalSubsub = null;

      if (f.generalCategoryName) {
        generalCat = await upsertGeneralCategoryByName(f.generalCategoryName, 'opportunity');
        if (f.generalSubcategoryName) {
          generalSub = await upsertGeneralSubcategoryByName(f.generalCategoryName, f.generalSubcategoryName, 'opportunity');
          if (f.generalSubsubCategoryName) {
            generalSubsub = await upsertGeneralSubsubCategoryByName(f.generalCategoryName, f.generalSubcategoryName, f.generalSubsubCategoryName, 'opportunity');
          }
        }
      }

      // Handle industry categories for funding
      let industryCat = null;
      let industrySub = null;
      let industrySubsub = null;

      if (f.industryCategoryName) {
        industryCat = await upsertIndustryCategoryByName(f.industryCategoryName);
        if (f.industrySubcategoryName) {
          industrySub = await upsertIndustrySubcategoryByName(f.industryCategoryName, f.industrySubcategoryName);
          if (f.industrySubsubCategoryName) {
            industrySubsub = await upsertIndustrySubsubCategoryByName(f.industryCategoryName, f.industrySubcategoryName, f.industrySubsubCategoryName);
          }
        }
      }

      const [funding, created] = await Funding.findOrCreate({
        where: {
          title: f.title,
          creatorUserId: creatorUserId,
        },
        defaults: {
          pitch: f.pitch,
          goal: f.goal,
          raised: f.raised || 0,
          currency: f.currency,
          deadline: f.deadline,
          country: f.country,
          city: f.city || null,
          rewards: f.rewards || null,
          team: f.team || null,
          email: f.email || null,
          phone: f.phone || null,
          status: f.status || 'published',
          visibility: f.visibility || 'public',
          tags: f.tags || [],
          links: f.links || [],
          images: f.images || [],
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          generalCategoryId: generalCat ? generalCat.id : null,
          generalSubcategoryId: generalSub ? generalSub.id : null,
          generalSubsubCategoryId: generalSubsub ? generalSubsub.id : null,
          industryCategoryId: industryCat ? industryCat.id : null,
          industrySubcategoryId: industrySub ? industrySub.id : null,
          industrySubsubCategoryId: industrySubsub ? industrySubsub.id : null,
          createdAt: daysAgo(f.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Funding: ${f.title}`);
      
      if (created && f.audience) {
        await associateWithAudience(funding, 'funding', f.audience);
        console.log(`   ↳ Associated funding with audience data`);
      }
    }

    // --- Seed Events ---
    const eventCount = await Event.count();
    
    for (const e of EVENT_SEEDS) {
      if (eventCount > 0) {
        console.log(`👥 Events already exist (${eventCount}), skipping event seed.`);
        break;
      }
      
      const organizerUserId = await getUserIdByEmail(e.organizerEmail);
      const cat = await upsertCategoryByName(e.categoryName);
      const sub = e.subcategoryName
        ? await upsertSubcategoryByName(e.categoryName, e.subcategoryName)
        : null;

      // Handle general categories for events
      let generalCat = null;
      let generalSub = null;
      let generalSubsub = null;

      if (e.generalCategoryName) {
        generalCat = await upsertGeneralCategoryByName(e.generalCategoryName, 'event');
        if (e.generalSubcategoryName) {
          generalSub = await upsertGeneralSubcategoryByName(e.generalCategoryName, e.generalSubcategoryName, 'event');
          if (e.generalSubsubCategoryName) {
            generalSubsub = await upsertGeneralSubsubCategoryByName(e.generalCategoryName, e.generalSubcategoryName, e.generalSubsubCategoryName, 'event');
          }
        }
      }

      // Handle industry categories for events
      let industryCat = null;
      let industrySub = null;
      let industrySubsub = null;

      if (e.industryCategoryName) {
        industryCat = await upsertIndustryCategoryByName(e.industryCategoryName);
        if (e.industrySubcategoryName) {
          industrySub = await upsertIndustrySubcategoryByName(e.industryCategoryName, e.industrySubcategoryName);
          if (e.industrySubsubCategoryName) {
            industrySubsub = await upsertIndustrySubsubCategoryByName(e.industryCategoryName, e.industrySubcategoryName, e.industrySubsubCategoryName);
          }
        }
      }

      const [event, created] = await Event.findOrCreate({
        where: {
          title: e.title,
          organizerUserId: organizerUserId,
        },
        defaults: {
          eventType: e.eventType,
          description: e.description,
          startAt: e.startAt,
          endAt: e.endAt,
          locationType: e.locationType,
          address: e.address,
          country: e.country,
          city: e.city,
          onlineUrl: e.onlineUrl || null,
          registrationType: e.registrationType,
          price: e.price || null,
          currency: e.currency,
          capacity: e.capacity || null,
          coverImageUrl: e.coverImageUrl || null,
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          generalCategoryId: generalCat ? generalCat.id : null,
          generalSubcategoryId: generalSub ? generalSub.id : null,
          generalSubsubCategoryId: generalSubsub ? generalSubsub.id : null,
          industryCategoryId: industryCat ? industryCat.id : null,
          industrySubcategoryId: industrySub ? industrySub.id : null,
          industrySubsubCategoryId: industrySubsub ? industrySubsub.id : null,
          createdAt: daysAgo(e.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Event: ${e.title}`);
      
      if (created && e.audience) {
        await associateWithAudience(event, 'event', e.audience);
        console.log(`   ↳ Associated event with audience data`);
      }
    }

    // --- Seed Jobs ---
    const jobCount = await Job.count();
    
    for (const j of JOB_SEEDS) {
      if (jobCount > 0) {
        console.log(`👥 Jobs already exist (${jobCount}), skipping job seed.`);
        break;
      }
      
      const postedByUserId = await getUserIdByEmail(j.postedByEmail);
      const cat = await upsertCategoryByName(j.categoryName);
      const sub = j.subcategoryName
        ? await upsertSubcategoryByName(j.categoryName, j.subcategoryName)
        : null;

      // Handle industry categories for jobs
      let industryCat = null;
      let industrySub = null;
      let industrySubsub = null;

      if (j.industryCategoryName) {
        industryCat = await upsertIndustryCategoryByName(j.industryCategoryName);
        if (j.industrySubcategoryName) {
          industrySub = await upsertIndustrySubcategoryByName(j.industryCategoryName, j.industrySubcategoryName);
          if (j.industrySubsubCategoryName) {
            industrySubsub = await upsertIndustrySubsubCategoryByName(j.industryCategoryName, j.industrySubcategoryName, j.industrySubsubCategoryName);
          }
        }
      }

      const [job, created] = await Job.findOrCreate({
        where: {
          title: j.title,
          postedByUserId: postedByUserId,
        },
        defaults: {
          jobType: j.jobType,
          description: j.description,
          companyName: j.companyName,
          make_company_name_private: j.make_company_name_private || false,
          department: j.department || null,
          experienceLevel: j.experienceLevel || null,
          workMode: j.workMode,
          requiredSkills: j.requiredSkills || [],
          country: j.country,
          city: j.city || null,
          minSalary: 10000 || null,
          maxSalary: 40000 || null,
          currency: j.currency || null,
          benefits: j.benefits || null,
          applicationDeadline: j.applicationDeadline,
          positions: j.positions || 1,
          applicationInstructions: j.applicationInstructions || null,
          contactEmail: j.contactEmail || null,
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          industryCategoryId: industryCat ? industryCat.id : null,
          industrySubcategoryId: industrySub ? industrySub.id : null,
          industrySubsubCategoryId: industrySubsub ? industrySubsub.id : null,
          status: "published",
          createdAt: daysAgo(j.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
          coverImageBase64: j.coverImageBase64 || null,
        },
      });

      console.log(`${created ? "✅" : "↺"} Job: ${j.title}`);
      
      if (created && j.audience) {
        await associateWithAudience(job, 'job', j.audience);
        console.log(`   ↳ Associated job with audience data`);
      }
    }

    console.log("🎉 Products, Services, Tourism, Funding, Events, and Jobs seeding done.");
  } catch (err) {
    console.error("❌ Seed failed:", err);
  }
}
run();