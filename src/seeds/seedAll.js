const seedUsers = require("./seedUsers");
//const seedNews = require("./seedNews");

async function seedAll() {
    return
  const userCount = await User.count();

  if (userCount === 0) {
    console.log("🌱 No users found → Seeding users...");
    await seedUsers();
  } else {
    console.log(`👥 Users already exist (${userCount}), skipping user seed.`);
  }

  if (newsCount === 0) {
    console.log("📰 No news articles found → Seeding news...");
    await seedNews();
  } else {
    console.log(`📰 News already exist (${newsCount}), skipping news seed.`);
  }
}

module.exports = seedAll;
