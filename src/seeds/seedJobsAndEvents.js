// src/seeds/seedJobsAndEvents.js
require("dotenv").config();

const {
  sequelize,
  User,
  Category,
  Subcategory,
  Job,
  Event,
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

// 1x1 PNG transparente (pode usar em coverImageBase64 se quiser preencher)
const TRANSPARENT_PNG_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

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

async function getUserIdByEmail(email) {
  const u = await User.findOne({ where: { email } });
  if (!u) throw new Error(`User not found for email: ${email}`);
  return u.id;
}

/** ------------------------- Seed Data ------------------------- **/

// Use emails que você já criou no seedUsers.js
const JOB_SEEDS = [
  {
    title: "Frontend Engineer (React/Next.js)",
    companyName: "NaijaPay",
    department: "Engineering",
    experienceLevel: "Mid-level",
    jobType: "Full-time",
    workMode: "Hybrid",
    description:
      "Trabalhar no time de pagamentos, construir features em React/Next, performance-first, boas práticas.",
    requiredSkills: ["React", "Next.js", "TypeScript", "REST"],
    country: "Nigeria",
    city: "Abuja",
    minSalary: 2000,
    maxSalary: 3500,
    currency: "USD",
    benefits: "Health plan; Remote stipend; Learning budget",
    applicationDeadline: null,
    positions: 2,
    applicationInstructions: "Envie CV e portfolio para jobs@naijapay.africa",
    contactEmail: "jobs@naijapay.africa",
    postedByEmail: "naija-fintech@54links.com",
    categoryName: "Technology",
    subcategoryName: "Software Development",
    coverImageBase64: 'https://img.freepik.com/free-photo/business-executives-participating-business-meeting_107420-63841.jpg',
    createdAtDaysAgo: 3,
  },
  {
    title: "Data Analyst (Marketing Attribution)",
    companyName: "AfriAgro Ltd.",
    department: "Analytics",
    experienceLevel: "Mid-level",
    jobType: "Full-time",
    workMode: "Remote",
    description:
      "Criação de relatórios, ETL e análises de campanhas. Experiência com SQL e Python.",
    requiredSkills: ["SQL", "Python", "Power BI", "ETL"],
    country: "Ghana",
    city: "Accra",
    minSalary: 1800,
    maxSalary: 3000,
    currency: "USD",
    benefits: "Gym; Health; Annual bonus",
    applicationDeadline: null,
    positions: 1,
    applicationInstructions: "Aplicar via portal: careers.afriagro.com",
    contactEmail: "hr@afriagro.com",
    postedByEmail: "afri-agro@54links.com",
    categoryName: "Technology",
    subcategoryName: "Data Analysis",
    coverImageBase64: 'https://img.freepik.com/free-photo/advisory-board-members-team-leaders-gathering-review-project-outcomes_482257-122887.jpg',
    createdAtDaysAgo: 8,
  },
  {
    title: "Brand & UI Designer",
    companyName: "Kilima Logistics",
    department: "Design",
    experienceLevel: "Senior",
    jobType: "Contract",
    workMode: "Remote",
    description:
      "Criação de sistemas de marca, UI-kits e fluxos. Forte experiência com Figma.",
    requiredSkills: ["Figma", "Design Systems", "Branding"],
    country: "Kenya",
    city: "Nairobi",
    minSalary: 2500,
    maxSalary: 4000,
    currency: "USD",
    benefits: "Remote; Flexible hours",
    applicationDeadline: null,
    positions: 1,
    applicationInstructions: "Envie portfolio para design@kilimalogistics.co.ke",
    contactEmail: "design@kilimalogistics.co.ke",
    postedByEmail: "kenya-logistics@54links.com",
    categoryName: "Marketing & Advertising",
    subcategoryName: "Branding & Creative Strategy",
    coverImageBase64: 'https://img.freepik.com/free-photo/representations-user-experience-interface-design_23-2150038909.jpg',
    createdAtDaysAgo: 12,
  },
  {
    title: "Solar Project Engineer",
    companyName: "SA Renewables",
    department: "Engineering",
    experienceLevel: "Senior",
    jobType: "Full-time",
    workMode: "On-site",
    description:
      "Engenheiro de projetos solares para usinas de médio/grande porte. EPC + grid.",
    requiredSkills: ["Solar", "EPC", "AutoCAD", "Project Management"],
    country: "South Africa",
    city: "Cape Town",
    minSalary: 3500,
    maxSalary: 6000,
    currency: "USD",
    benefits: "Relocation; Health; Bonus",
    applicationDeadline: null,
    positions: 2,
    applicationInstructions: "Aplicar em careers.sarenew.co.za",
    contactEmail: "hr@sarenew.co.za",
    postedByEmail: "sa-renew@54links.com",
    categoryName: "Energy",
    subcategoryName: "Renewable Energy (Solar, Wind, Hydro)",
    coverImageBase64: null,
    createdAtDaysAgo: 2,
  },
  {
    title: "Logistics Operations Manager",
    companyName: "Kilima Logistics",
    department: "Operations",
    experienceLevel: "Lead",
    jobType: "Full-time",
    workMode: "On-site",
    description:
      "Gerir operações de last-mile, otimizar rotas e SLAs, liderar equipes.",
    requiredSkills: ["Logistics", "Ops", "SLA", "Team Leadership"],
    country: "Kenya",
    city: "Nairobi",
    minSalary: 3000,
    maxSalary: 5000,
    currency: "USD",
    benefits: "Company car; Health",
    applicationDeadline: null,
    positions: 1,
    applicationInstructions: "Enviar CV para ops@kilimalogistics.co.ke",
    contactEmail: "ops@kilimalogistics.co.ke",
    postedByEmail: "kenya-logistics@54links.com",
    categoryName: "E-Commerce",
    subcategoryName: "Logistics & Delivery Services",
    coverImageBase64: null,
    createdAtDaysAgo: 18,
  },
  {
    title: "Payments Backend Engineer (Node.js)",
    companyName: "NaijaPay",
    department: "Engineering",
    experienceLevel: "Senior",
    jobType: "Full-time",
    workMode: "Hybrid",
    description:
      "Construir serviços de pagamentos de alta disponibilidade (Node.js, Kafka).",
    requiredSkills: ["Node.js", "Kafka", "PostgreSQL", "DDD"],
    country: "Nigeria",
    city: "Lagos",
    minSalary: 3000,
    maxSalary: 5500,
    currency: "USD",
    benefits: "Health; Stock options",
    applicationDeadline: null,
    positions: 3,
    applicationInstructions: "Aplicar via jobs@naijapay.africa",
    contactEmail: "jobs@naijapay.africa",
    postedByEmail: "naija-fintech@54links.com",
    categoryName: "Technology",
    subcategoryName: "Fintech",
    coverImageBase64: TRANSPARENT_PNG_BASE64,
    createdAtDaysAgo: 5,
  },
];

const EVENT_SEEDS = [
  {
    title: "Lagos Fintech Connect",
    description:
      "Encontro para founders e devs do ecossistema de pagamentos na África Ocidental.",
    eventType: "Networking",
    categoryName: "Technology",
    subcategoryName: "Fintech",
    startAt: daysAgo(-3), // futuro: -3 => 3 dias à frente
    endAt: daysAgo(-3.0),
    timezone: "Africa/Lagos",
    locationType: "In-Person",
    country: "Nigeria",
    city: "Lagos",
    address: "Victoria Island Convention Center",
    registrationType: "Paid",
    price: 25,
    currency: "USD",
    capacity: 200,
    registrationDeadline: daysAgo(-4),
    organizerEmail: "naija-fintech@54links.com",
    coverImageBase64: 'https://img.freepik.com/free-photo/professional-team-analyzing-archived-data-financial-file-meeting_482257-114412.jpg',
    createdAtDaysAgo: 1,
  },
  {
    title: "Agro-Tech Summit Accra",
    description:
      "Workshop/Conferência para agro-processamento e integração com plataformas digitais.",
    eventType: "Conference",
    categoryName: "Agriculture",
    subcategoryName: "Agro-Tech",
    startAt: daysAgo(-10),
    endAt: daysAgo(-10),
    timezone: "Africa/Accra",
    locationType: "Hybrid",
    country: "Ghana",
    city: "Accra",
    address: "Accra Trade Center",
    registrationType: "Free",
    price: null,
    currency: null,
    capacity: 500,
    registrationDeadline: daysAgo(-12),
    organizerEmail: "afri-agro@54links.com",
    coverImageBase64: 'https://img.freepik.com/free-photo/photorealistic-woman-organic-sustainable-garden-harvesting-produce_23-2151463029.jpg',
    createdAtDaysAgo: 7,
  },
  {
    title: "SADC Solar Expo",
    description:
      "Feira com players de energia renovável e storage. Rodadas de negócios.",
    eventType: "Conference",
    categoryName: "Energy",
    subcategoryName: "Renewable Energy (Solar, Wind, Hydro)",
    startAt: daysAgo(-15),
    endAt: daysAgo(-14),
    timezone: "Africa/Johannesburg",
    locationType: "In-Person",
    country: "South Africa",
    city: "Cape Town",
    address: "CTICC",
    registrationType: "Paid",
    price: 40,
    currency: "USD",
    capacity: 1000,
    registrationDeadline: daysAgo(-16),
    organizerEmail: "sa-renew@54links.com",
    coverImageBase64: 'https://img.freepik.com/premium-photo/high-angle-view-buildings-trees-city_1048944-8253395.jpg',
    createdAtDaysAgo: 9,
  },
  {
    title: "Logistics & E-comm Meetup Nairobi",
    description:
      "Networking com gestores de operações, 3PL e marketplaces da região.",
    eventType: "Networking",
    categoryName: "E-Commerce",
    subcategoryName: "Logistics & Delivery Services",
    startAt: daysAgo(-6),
    endAt: daysAgo(-6),
    timezone: "Africa/Nairobi",
    locationType: "In-Person",
    country: "Kenya",
    city: "Nairobi",
    address: "Nairobi Tech Hub",
    registrationType: "Free",
    price: null,
    currency: null,
    capacity: 150,
    registrationDeadline: daysAgo(-7),
    organizerEmail: "kenya-logistics@54links.com",
    coverImageBase64: 'https://img.freepik.com/free-photo/logistics-department-managers-planning-stock-supply-schedule-warehouse-counter-desk-all-black-storehouse-employees-team-managing-parcel-registration-dispatching-process_482257-71414.jpg',
    createdAtDaysAgo: 4,
  },
  {
    title: "Design Systems for Startups",
    description:
      "Workshop prático sobre montagem de sistemas de design e UI kits.",
    eventType: "Workshop",
    categoryName: "Marketing & Advertising",
    subcategoryName: "Branding & Creative Strategy",
    startAt: daysAgo(-1),
    endAt: daysAgo(-1),
    timezone: "Africa/Nairobi",
    locationType: "Virtual",
    onlineUrl: "https://meet.example.com/design",
    country: "Kenya",
    city: "Nairobi",
    address: null,
    registrationType: "Paid",
    price: 15,
    currency: "USD",
    capacity: 80,
    registrationDeadline: daysAgo(-2),
    organizerEmail: "kenya-logistics@54links.com",
    coverImageBase64: 'https://img.freepik.com/free-photo/woman-using-ai-llm-greets-friend-videocall-green-screen-phone_482257-127297.jpg',
    createdAtDaysAgo: 0,
  },
];

/** ------------------------- Main ------------------------- **/

(async () => {
  try {
    await sequelize.authenticate();
    console.log("🔌 DB connected (seed jobs/events).");

    // NÃO chamamos sync aqui para não alterar seu schema em produção
    // await sequelize.sync({ alter: true });

    // --- Seed Jobs ---
     const jobCount = await Job.count();
     const eventCount = await Event.count();
   

    for (const j of JOB_SEEDS) {
        if(jobCount === 0) {
            console.log(`👥 Jobs already exist (${jobCount}), skipping job seed.`);
        }
      const postedByUserId = await getUserIdByEmail(j.postedByEmail);
      const cat = await upsertCategoryByName(j.categoryName);
      const sub = j.subcategoryName
        ? await upsertSubcategoryByName(j.categoryName, j.subcategoryName)
        : null;

      // Evitar duplicados por (title + company + city)
      const [row, created] = await Job.findOrCreate({
        where: {
          title: j.title,
          companyName: j.companyName,
          city: j.city || null,
        },
        defaults: {
          department: j.department || null,
          experienceLevel: j.experienceLevel || null,
          jobType: j.jobType,
          workMode: j.workMode,
          description: j.description,
          requiredSkills: j.requiredSkills || [],
          country: j.country,
          city: j.city || null,
          minSalary: j.minSalary || null,
          maxSalary: j.maxSalary || null,
          currency: j.currency || null,
          benefits: j.benefits || null,
          applicationDeadline: j.applicationDeadline || null,
          positions: j.positions || 1,
          applicationInstructions: j.applicationInstructions || null,
          contactEmail: j.contactEmail || null,
          postedByUserId,
          categoryId: cat.id,
          subcategoryId: sub ? sub.id : null,
          status: "published",
          coverImageBase64: j.coverImageBase64 || null,
          createdAt: daysAgo(j.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Job: ${j.title} @ ${j.companyName}`);
    }

    // --- Seed Events ---
    for (const e of EVENT_SEEDS) {
         if(eventCount === 0) {
        console.log(`👥 Jobs already exist (${eventCount}), skipping job seed.`);
    }
      const organizerUserId = await getUserIdByEmail(e.organizerEmail);
      const cat = e.categoryName
        ? await upsertCategoryByName(e.categoryName)
        : null;
      const sub =
        e.categoryName && e.subcategoryName
          ? await upsertSubcategoryByName(e.categoryName, e.subcategoryName)
          : null;

      // Evitar duplicados por (title + city + startAt)
      const [row, created] = await Event.findOrCreate({
        where: {
          title: e.title,
          city: e.city || null,
          startAt: e.startAt,
        },
        defaults: {
          organizerUserId,
          description: e.description,
          eventType: e.eventType,
          categoryId: cat ? cat.id : null,
          subcategoryId: sub ? sub.id : null,
          startAt: e.startAt,
          endAt: e.endAt || null,
          timezone: e.timezone || null,
          locationType: e.locationType,
          country: e.country || null,
          city: e.city || null,
          address: e.address || null,
          onlineUrl: e.onlineUrl || null,
          registrationType: e.registrationType,
          price: e.price || null,
          currency: e.currency || null,
          capacity: e.capacity || null,
          registrationDeadline: e.registrationDeadline || null,
          coverImageBase64: e.coverImageBase64 || null,
          coverImageUrl: null,
          createdAt: daysAgo(e.createdAtDaysAgo ?? randBetween(1, 25)),
          updatedAt: new Date(),
        },
      });

      console.log(`${created ? "✅" : "↺"} Event: ${e.title} (${e.city || e.locationType})`);
    }

    console.log("🎉 Jobs & Events seeding done.");
    // process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    // process.exit(1);
  }
})();
