const { Sequelize } = require("sequelize");

function makeSequelize() {
  if (process.env.DATABASE_URL) {
    // if using connection URL
    return new Sequelize(process.env.DATABASE_URL, {
      dialect: "mysql",
      logging: false,
    });
  }

  return new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      dialect: "mysql",
      logging: false,
    }
  );
}

module.exports = { makeSequelize };
