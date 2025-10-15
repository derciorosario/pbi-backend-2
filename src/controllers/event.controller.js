const { Event, Category, Subcategory, SubsubCategory } = require("../models");
const { Op } = require("sequelize");
const { toIdArray, normalizeIdentityIds, validateAudienceHierarchy, setEventAudience } = require("./_eventAudienceHelpers");
const { cache } = require("../utils/redis");

const EVENT_CACHE_TTL = 300;

function generateEventCacheKey(eventId) {
  return `event:${eventId}`;
}

// tiny helper
function ensurePaidFields(body) {
  if (body.registrationType === "Paid") {
    if (body.price == null || body.price === "")
      throw new Error("Price is required for paid events");
    if (!body.currency) throw new Error("Currency is required for paid events");
  }
}

function combineDateTime(dateStr, timeStr, tz) {
  // Expect date: "YYYY-MM-DD", time: "HH:mm" (24h). Store as UTC Date.
  // If you already send ISO from FE, you can skip this.
  const iso = `${dateStr}T${timeStr || "00:00"}:00${tz ? "" : "Z"}`;
  // We store raw ISO; DB will keep timestamp; FE can handle formatting by tz
  return new Date(iso);
}

exports.getMeta = async (req, res) => {
  const categories = await Category.findAll({
    order: [["name", "ASC"]],
    include: [{ model: Subcategory, as: "subcategories", order: [["name", "ASC"]] }],
  });

  const currencies = [
    "USD","EUR","GBP","NGN","ZAR","GHS","KES","TZS","MAD","EGP","XOF","XAF","CFA","AOA","ETB","UGX","RWF","BWP","NAD","MZN"
  ];


  const timezones = [
  "Africa/Abidjan",
  "Africa/Accra",
  "Africa/Addis_Ababa",
  "Africa/Algiers",
  "Africa/Asmara",
  "Africa/Bamako",
  "Africa/Bangui",
  "Africa/Banjul",
  "Africa/Bissau",
  "Africa/Blantyre",
  "Africa/Brazzaville",
  "Africa/Bujumbura",
  "Africa/Cairo",
  "Africa/Casablanca",
  "Africa/Ceuta",
  "Africa/Conakry",
  "Africa/Dakar",
  "Africa/Dar_es_Salaam",
  "Africa/Djibouti",
  "Africa/Douala",
  "Africa/El_Aaiun",
  "Africa/Freetown",
  "Africa/Gaborone",
  "Africa/Harare",
  "Africa/Johannesburg",
  "Africa/Juba",
  "Africa/Kampala",
  "Africa/Khartoum",
  "Africa/Kigali",
  "Africa/Kinshasa",
  "Africa/Lagos",
  "Africa/Libreville",
  "Africa/Lome",
  "Africa/Luanda",
  "Africa/Lubumbashi",
  "Africa/Lusaka",
  "Africa/Malabo",
  "Africa/Maputo",
  "Africa/Maseru",
  "Africa/Mbabane",
  "Africa/Mogadishu",
  "Africa/Monrovia",
  "Africa/Nairobi",
  "Africa/Ndjamena",
  "Africa/Niamey",
  "Africa/Nouakchott",
  "Africa/Ouagadougou",
  "Africa/Porto-Novo",
  "Africa/Sao_Tome",
  "Africa/Tripoli",
  "Africa/Tunis",
  "Africa/Windhoek",

  "America/Adak",
  "America/Anchorage",
  "America/Anguilla",
  "America/Antigua",
  "America/Araguaina",
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Catamarca",
  "America/Argentina/Cordoba",
  "America/Argentina/Jujuy",
  "America/Argentina/La_Rioja",
  "America/Argentina/Mendoza",
  "America/Argentina/Rio_Gallegos",
  "America/Argentina/Salta",
  "America/Argentina/San_Juan",
  "America/Argentina/San_Luis",
  "America/Argentina/Tucuman",
  "America/Argentina/Ushuaia",
  "America/Aruba",
  "America/Asuncion",
  "America/Atikokan",
  "America/Bahia",
  "America/Bahia_Banderas",
  "America/Barbados",
  "America/Belem",
  "America/Belize",
  "America/Blanc-Sablon",
  "America/Boa_Vista",
  "America/Bogota",
  "America/Boise",
  "America/Cambridge_Bay",
  "America/Campo_Grande",
  "America/Cancun",
  "America/Caracas",
  "America/Cayenne",
  "America/Cayman",
  "America/Chicago",
  "America/Chihuahua",
  "America/Costa_Rica",
  "America/Creston",
  "America/Cuiaba",
  "America/Curacao",
  "America/Danmarkshavn",
  "America/Dawson",
  "America/Dawson_Creek",
  "America/Denver",
  "America/Detroit",
  "America/Dominica",
  "America/Edmonton",
  "America/Eirunepe",
  "America/El_Salvador",
  "America/Fortaleza",
  "America/Fort_Nelson",
  "America/Glace_Bay",
  "America/Godthab",
  "America/Goose_Bay",
  "America/Grand_Turk",
  "America/Grenada",
  "America/Guadeloupe",
  "America/Guatemala",
  "America/Guayaquil",
  "America/Guyana",
  "America/Halifax",
  "America/Havana",
  "America/Hermosillo",
  "America/Indiana/Indianapolis",
  "America/Indiana/Knox",
  "America/Indiana/Marengo",
  "America/Indiana/Petersburg",
  "America/Indiana/Tell_City",
  "America/Indiana/Vevay",
  "America/Indiana/Vincennes",
  "America/Indiana/Winamac",
  "America/Inuvik",
  "America/Iqaluit",
  "America/Jamaica",
  "America/Juneau",
  "America/Kentucky/Louisville",
  "America/Kentucky/Monticello",
  "America/Kralendijk",
  "America/La_Paz",
  "America/Lima",
  "America/Los_Angeles",
  "America/Lower_Princes",
  "America/Maceio",
  "America/Managua",
  "America/Manaus",
  "America/Marigot",
  "America/Martinique",
  "America/Matamoros",
  "America/Mazatlan",
  "America/Menominee",
  "America/Merida",
  "America/Metlakatla",
  "America/Mexico_City",
  "America/Miquelon",
  "America/Moncton",
  "America/Monterrey",
  "America/Montevideo",
  "America/Montserrat",
  "America/Nassau",
  "America/New_York",
  "America/Nipigon",
  "America/Nome",
  "America/Noronha",
  "America/North_Dakota/Beulah",
  "America/North_Dakota/Center",
  "America/North_Dakota/New_Salem",
  "America/Nuuk",
  "America/Ojinaga",
  "America/Panama",
  "America/Pangnirtung",
  "America/Paramaribo",
  "America/Phoenix",
  "America/Port-au-Prince",
  "America/Port_of_Spain",
  "America/Porto_Velho",
  "America/Puerto_Rico",
  "America/Punta_Arenas",
  "America/Rainy_River",
  "America/Rankin_Inlet",
  "America/Recife",
  "America/Regina",
  "America/Resolute",
  "America/Rio_Branco",
  "America/Santarem",
  "America/Santiago",
  "America/Santo_Domingo",
  "America/Sao_Paulo",
  "America/Scoresbysund",
  "America/Sitka",
  "America/St_Barthelemy",
  "America/St_Johns",
  "America/St_Kitts",
  "America/St_Lucia",
  "America/St_Thomas",
  "America/St_Vincent",
  "America/Swift_Current",
  "America/Tegucigalpa",
  "America/Thule",
  "America/Thunder_Bay",
  "America/Tijuana",
  "America/Toronto",
  "America/Tortola",
  "America/Vancouver",
  "America/Whitehorse",
  "America/Winnipeg",
  "America/Yakutat",
  "America/Yellowknife",

  "Antarctica/Casey",
  "Antarctica/Davis",
  "Antarctica/DumontDUrville",
  "Antarctica/Macquarie",
  "Antarctica/Mawson",
  "Antarctica/Palmer",
  "Antarctica/Rothera",
  "Antarctica/Syowa",
  "Antarctica/Troll",
  "Antarctica/Vostok",

  "Arctic/Longyearbyen",

  "Asia/Aden",
  "Asia/Almaty",
  "Asia/Amman",
  "Asia/Anadyr",
  "Asia/Aqtau",
  "Asia/Aqtobe",
  "Asia/Ashgabat",
  "Asia/Atyrau",
  "Asia/Baghdad",
  "Asia/Bahrain",
  "Asia/Baku",
  "Asia/Bangkok",
  "Asia/Barnaul",
  "Asia/Beirut",
  "Asia/Bishkek",
  "Asia/Brunei",
  "Asia/Chita",
  "Asia/Choibalsan",
  "Asia/Colombo",
  "Asia/Damascus",
  "Asia/Dhaka",
  "Asia/Dili",
  "Asia/Dubai",
  "Asia/Dushanbe",
  "Asia/Famagusta",
  "Asia/Gaza",
  "Asia/Hebron",
  "Asia/Ho_Chi_Minh",
  "Asia/Hong_Kong",
  "Asia/Hovd",
  "Asia/Irkutsk",
  "Asia/Jakarta",
  "Asia/Jayapura",
  "Asia/Jerusalem",
  "Asia/Kabul",
  "Asia/Kamchatka",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Khandyga",
  "Asia/Kolkata",
  "Asia/Krasnoyarsk",
  "Asia/Kuala_Lumpur",
  "Asia/Kuching",
  "Asia/Kuwait",
  "Asia/Macau",
  "Asia/Magadan",
  "Asia/Makassar",
  "Asia/Manila",
  "Asia/Muscat",
  "Asia/Nicosia",
  "Asia/Novokuznetsk",
  "Asia/Novosibirsk",
  "Asia/Omsk",
  "Asia/Oral",
  "Asia/Phnom_Penh",
  "Asia/Pontianak",
  "Asia/Pyongyang",
  "Asia/Qatar",
  "Asia/Qostanay",
  "Asia/Qyzylorda",
  "Asia/Riyadh",
  "Asia/Sakhalin",
  "Asia/Samarkand",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Srednekolymsk",
  "Asia/Taipei",
  "Asia/Tashkent",
  "Asia/Tbilisi",
  "Asia/Tehran",
  "Asia/Thimphu",
  "Asia/Tokyo",
  "Asia/Tomsk",
  "Asia/Ulaanbaatar",
  "Asia/Urumqi",
  "Asia/Ust-Nera",
  "Asia/Vientiane",
  "Asia/Vladivostok",
  "Asia/Yakutsk",
  "Asia/Yangon",
  "Asia/Yekaterinburg",
  "Asia/Yerevan",

  "Atlantic/Azores",
  "Atlantic/Bermuda",
  "Atlantic/Canary",
  "Atlantic/Cape_Verde",
  "Atlantic/Faroe",
  "Atlantic/Madeira",
  "Atlantic/Reykjavik",
  "Atlantic/South_Georgia",
  "Atlantic/St_Helena",
  "Atlantic/Stanley",

  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Broken_Hill",
  "Australia/Darwin",
  "Australia/Eucla",
  "Australia/Hobart",
  "Australia/Lindeman",
  "Australia/Lord_Howe",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",

  "Europe/Amsterdam",
  "Europe/Andorra",
  "Europe/Astrakhan",
  "Europe/Athens",
  "Europe/Belgrade",
  "Europe/Berlin",
  "Europe/Bratislava",
  "Europe/Brussels",
  "Europe/Bucharest",
  "Europe/Budapest",
  "Europe/Busingen",
  "Europe/Chisinau",
  "Europe/Copenhagen",
  "Europe/Dublin",
  "Europe/Gibraltar",
  "Europe/Guernsey",
  "Europe/Helsinki",
  "Europe/Isle_of_Man",
  "Europe/Istanbul",
  "Europe/Jersey",
  "Europe/Kaliningrad",
  "Europe/Kiev",
  "Europe/Kirov",
  "Europe/Lisbon",
  "Europe/Ljubljana",
  "Europe/London",
  "Europe/Luxembourg",
  "Europe/Madrid",
  "Europe/Malta",
  "Europe/Mariehamn",
  "Europe/Minsk",
  "Europe/Monaco",
  "Europe/Moscow",
  "Europe/Oslo",
  "Europe/Paris",
  "Europe/Podgorica",
  "Europe/Prague",
  "Europe/Riga",
  "Europe/Rome",
  "Europe/Samara",
  "Europe/San_Marino",
  "Europe/Sarajevo",
  "Europe/Saratov",
  "Europe/Simferopol",
  "Europe/Skopje",
  "Europe/Sofia",
  "Europe/Stockholm",
  "Europe/Tallinn",
  "Europe/Tirane",
  "Europe/Ulyanovsk",
  "Europe/Uzhgorod",
  "Europe/Vaduz",
  "Europe/Vatican",
  "Europe/Vienna",
  "Europe/Vilnius",
  "Europe/Volgograd",
  "Europe/Warsaw",
  "Europe/Zagreb",
  "Europe/Zaporozhye",
  "Europe/Zurich",

  "Indian/Antananarivo",
  "Indian/Chagos",
  "Indian/Christmas",
  "Indian/Cocos",
  "Indian/Comoro",
  "Indian/Kerguelen",
  "Indian/Mahe",
  "Indian/Maldives",
  "Indian/Mauritius",
  "Indian/Mayotte",
  "Indian/Reunion",

  "Pacific/Apia",
  "Pacific/Auckland",
  "Pacific/Bougainville",
  "Pacific/Chatham",
  "Pacific/Chuuk",
  "Pacific/Easter",
  "Pacific/Efate",
  "Pacific/Enderbury",
  "Pacific/Fakaofo",
  "Pacific/Fiji",
  "Pacific/Funafuti",
  "Pacific/Galapagos",
  "Pacific/Gambier",
  "Pacific/Guadalcanal",
  "Pacific/Guam",
  "Pacific/Honolulu",
  "Pacific/Kanton",
  "Pacific/Kiritimati",
  "Pacific/Kosrae",
  "Pacific/Kwajalein",
  "Pacific/Majuro",
  "Pacific/Marquesas",
  "Pacific/Midway",
  "Pacific/Nauru",
  "Pacific/Niue",
  "Pacific/Norfolk",
  "Pacific/Noumea",
  "Pacific/Pago_Pago",
  "Pacific/Palau",
  "Pacific/Pitcairn",
  "Pacific/Pohnpei",
  "Pacific/Port_Moresby",
  "Pacific/Rarotonga",
  "Pacific/Saipan",
  "Pacific/Tahiti",
  "Pacific/Tarawa",
  "Pacific/Tongatapu",
  "Pacific/Wake",
  "Pacific/Wallis"
];


  res.json({ categories, currencies, timezones });
};

exports.create = async (req, res) => {
  try {
    const uid = req.user?.id; // from auth middleware
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      description,
      eventType,
      categoryId,
      subcategoryId,

      // date/time from FE:
      date,        // "YYYY-MM-DD"
      startTime,   // "HH:mm"
      endTime,     // "HH:mm"
      timezone,

      locationType,
      country,
      city,
      address,
      onlineUrl,

      registrationType,
      price,
      currency,
      capacity,
      registrationDeadline, // "YYYY-MM-DD"
      coverImageUrl,
      coverImageBase64,

      // Audience selection
      identityIds: _identityIds,
      categoryIds: _categoryIds,
      subcategoryIds: _subcategoryIds,
      subsubCategoryIds: _subsubCategoryIds,


      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,

      // Industry fields
      industryCategoryId,
      industrySubcategoryId,
    } = req.body;

    if (!title || !description) return res.status(400).json({ message: "Title and description are required" });
    if (!eventType) return res.status(400).json({ message: "Event type is required" });
    if (!locationType) return res.status(400).json({ message: "Location type is required" });
    if (!date || !startTime) return res.status(400).json({ message: "Date and start time are required" });

    ensurePaidFields({ registrationType, price, currency });

    // Normalize audience arrays
    const identityIds = await normalizeIdentityIds(toIdArray(_identityIds));
    const categoryIds = toIdArray(_categoryIds);
    const subcategoryIds = toIdArray(_subcategoryIds);
    const subsubCategoryIds = toIdArray(_subsubCategoryIds);

    // For backward compatibility, keep single categoryId/subcategoryId as before
    const primaryCategoryId = categoryId || categoryIds[0] || null;
    const primarySubcategoryId = subcategoryId || subcategoryIds[0] || null;

    // Validate category/subcategory pair (optional)
    if (primarySubcategoryId) {
      const sub = await Subcategory.findByPk(primarySubcategoryId);
      if (!sub) return res.status(400).json({ message: "Invalid subcategory" });
      if (primaryCategoryId && String(sub.categoryId) !== String(primaryCategoryId)) {
        return res.status(400).json({ message: "Subcategory does not belong to selected category" });
      }
    }

    // Validate audience hierarchy
    if (categoryIds.length || subcategoryIds.length || subsubCategoryIds.length) {
      try {
        await validateAudienceHierarchy({
          categoryIds: categoryIds.length ? categoryIds : (primaryCategoryId ? [primaryCategoryId] : []),
          subcategoryIds: subcategoryIds.length ? subcategoryIds : (primarySubcategoryId ? [primarySubcategoryId] : []),
          subsubCategoryIds
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    const startAt = combineDateTime(date, startTime, timezone);
    const endAt = endTime ? combineDateTime(date, endTime, timezone) : null;
    const regDeadline = registrationDeadline ? combineDateTime(registrationDeadline, "23:59", timezone) : null;

    const event = await Event.create({
      organizerUserId: uid,
      title,
      description,
      eventType,
      categoryId: primaryCategoryId,
      subcategoryId: primarySubcategoryId,
      startAt,
      endAt,
      timezone: timezone || null,
      locationType,
      country: country || null,
      city: city || null,
      address: address || null,
      onlineUrl: onlineUrl || null,
      registrationType,
      price: registrationType === "Paid" ? price : null,
      currency: registrationType === "Paid" ? currency : null,
      capacity: capacity || null,
      registrationDeadline: regDeadline,
      coverImageUrl: coverImageUrl || null,
      coverImageBase64:coverImageBase64 || null,
      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,
      industryCategoryId,
      industrySubcategoryId,
    });

    // Set audience associations
    await setEventAudience(event, {
      identityIds,
      categoryIds: categoryIds.length ? categoryIds : (primaryCategoryId ? [primaryCategoryId] : []),
      subcategoryIds: subcategoryIds.length ? subcategoryIds : (primarySubcategoryId ? [primarySubcategoryId] : []),
      subsubCategoryIds
    });

    const created = await Event.findByPk(event.id, {
      include: [
        { model: Category, as: "category" },
        { model: Subcategory, as: "subcategory" },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });
    
    await cache.deleteKeys([
      ["feed", "events", req.user.id] 
    ]);

    res.status(201).json(created);
  } catch (err) {
    console.error("createEvent error:", err);
    res.status(400).json({ message: err.message || "Could not create event" });
  }
};

exports.update = async (req, res) => {
  try {
    const uid = req.user?.id;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.organizerUserId !== uid && req.user?.accountType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const {
      registrationType,
      identityIds: _identityIds,
      categoryIds: _categoryIds,
      subcategoryIds: _subcategoryIds,
      subsubCategoryIds: _subsubCategoryIds,
      generalCategoryId,
      generalSubcategoryId,
      generalSubsubCategoryId,

      // Industry fields
      industryCategoryId,
      industrySubcategoryId,
      industrySubsubCategoryId,

      ...body
    } = req.body;
    
    if (registrationType) ensurePaidFields({ registrationType, ...body });


    // Normalize audience arrays if provided
    const identityIds = _identityIds !== undefined ? await normalizeIdentityIds(toIdArray(_identityIds)) : null;
    const categoryIds = _categoryIds !== undefined ? toIdArray(_categoryIds) : null;
    const subcategoryIds = _subcategoryIds !== undefined ? toIdArray(_subcategoryIds) : null;
    const subsubCategoryIds = _subsubCategoryIds !== undefined ? toIdArray(_subsubCategoryIds) : null;

    // Validate hierarchy if any of the arrays was provided
    if (categoryIds || subcategoryIds || subsubCategoryIds) {
      try {
        await validateAudienceHierarchy({
          categoryIds: categoryIds ?? [event.categoryId].filter(Boolean),
          subcategoryIds: subcategoryIds ?? [event.subcategoryId].filter(Boolean),
          subsubCategoryIds: subsubCategoryIds ?? [],
        });
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    // If FE still sends separate date/time updates:
    if (body.date || body.startTime || body.endTime) {
      const baseDate = body.date || event.startAt.toISOString().slice(0, 10);
      if (body.startTime) event.startAt = new Date(`${baseDate}T${body.startTime}:00Z`);
      if (body.endTime) event.endAt = new Date(`${baseDate}T${body.endTime}:00Z`);
    }

    // Simple update
    Object.assign(event, {
      title: body.title ?? event.title,
      description: body.description ?? event.description,
      eventType: body.eventType ?? event.eventType,
      categoryId: body.categoryId === '' ? null : (body.categoryId ?? event.categoryId),
      subcategoryId: body.subcategoryId === '' ? null : (body.subcategoryId ?? event.subcategoryId),
      timezone: body.timezone ?? event.timezone,
      locationType: body.locationType ?? event.locationType,
      country: body.country || null,
      coverImageBase64:body.coverImageBase64 || null,
      city: body.city || null,
      address: body.address ?? event.address,
      onlineUrl: body.onlineUrl ?? event.onlineUrl,
      registrationType: registrationType ?? event.registrationType,
      price: (registrationType || event.registrationType) === "Paid" ? (body.price ?? event.price) : null,
      currency: (registrationType || registrationType) === "Paid" ? (body.currency ?? event.currency) : null,
      capacity: body.capacity ?? event.capacity,
      registrationDeadline: body.registrationDeadline ? new Date(`${body.registrationDeadline}T23:59:00Z`) : event.registrationDeadline,
      coverImageUrl: body.coverImageUrl || null,
      generalCategoryId: generalCategoryId === '' ? null : generalCategoryId,
      generalSubcategoryId: generalSubcategoryId === '' ? null : generalSubcategoryId,
      generalSubsubCategoryId: generalSubsubCategoryId === '' ? null : generalSubsubCategoryId,
      industryCategoryId: industryCategoryId === '' ? null : industryCategoryId,
      industrySubcategoryId: industrySubcategoryId === '' ? null : industrySubcategoryId,
      industrySubsubCategoryId: industrySubsubCategoryId === '' ? null : industrySubsubCategoryId,
    });

    await event.save();

    // Update audience associations if provided
    if (identityIds !== null || categoryIds !== null || subcategoryIds !== null || subsubCategoryIds !== null) {
      await setEventAudience(event, {
        identityIds: identityIds ?? undefined,
        categoryIds: categoryIds ?? undefined,
        subcategoryIds: subcategoryIds ?? undefined,
        subsubCategoryIds: subsubCategoryIds ?? undefined,
      });
    }

 
    await cache.deleteKeys([
      ["feed", "events", req.user.id] 
    ]);
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);

    await exports.getOne({ params: { id: event.id }, query: { updated: true } }, res);
 
  } catch (err) {
    console.error("updateEvent error:", err);
    res.status(400).json({ message: err.message || "Could not update event" });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = req.query.updated;

    // Event cache: try read first
    const __eventCacheKey = generateEventCacheKey(id);

    if(!updated){
      try {
        const cached = await cache.get(__eventCacheKey);
        if (cached) {
          console.log(`✅ Event cache hit for key: ${__eventCacheKey}`);
          return res.json(cached);
        }
      } catch (e) {
        console.error("Event cache read error:", e.message);
      }
    }
   

    const event = await Event.findByPk(id, {
      include: [
        { model: Category, as: "category" },
        { model: Subcategory, as: "subcategory" },
        // Include audience associations
        { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
        { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
        { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
      ],
    });
    if (!event) return res.status(404).json({ message: "Event not found" });

    try {
      await cache.set(__eventCacheKey, event, EVENT_CACHE_TTL);
      console.log(`💾 Event cached: ${__eventCacheKey}`);
    } catch (e) {
      console.error("Event cache write error:", e.message);
    }

    res.json(event);
  } catch (err) {
    console.error("getOne error", err);
    res.status(500).json({ message: "Failed to fetch event" });
  }
};

exports.list = async (req, res) => {
  const { q, categoryId, country } = req.query;
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (country) where.country = country;
  if (q) {
    where[Op.or] = [
      { title: { [Op.like]: `%${q}%` } },
      { description: { [Op.like]: `%${q}%` } },
    ];
  }
  const rows = await Event.findAll({
    where,
    order: [["startAt", "ASC"]],
    include: [
      { model: Category, as: "category" },
      { model: Subcategory, as: "subcategory" },
      // Include audience associations
      { association: "audienceIdentities", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceCategories", attributes: ["id", "name"], through: { attributes: [] } },
      { association: "audienceSubcategories", attributes: ["id", "name", "categoryId"], through: { attributes: [] } },
      { association: "audienceSubsubs", attributes: ["id", "name", "subcategoryId"], through: { attributes: [] } },
    ],
  });
  res.json(rows);
};

// Handle cover image upload
exports.deleteEvent = async (req, res) => {
  try {
    const id = req.params.id;
    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (String(event.organizerUserId) !== String(req.user?.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await event.destroy();
    
    await cache.deleteKeys([
      ["feed", "events", req.user.id] 
    ]);
    await cache.deleteKeys([
      ["feed","all",req.user.id] 
    ]);
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("deleteEvent error", err);
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

    // Return the filename to be stored in the database
    const filename = req.file.filename;
    const filePath = `/uploads/${filename}`; // Path relative to server root

    res.status(200).json({
      success: true,
      filename: filename,
      filePath: filePath
    });
  } catch (err) {
    console.error("uploadCoverImage error", err);
    res.status(500).json({ message: err.message });
  }
};
