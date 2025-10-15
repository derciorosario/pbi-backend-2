const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      name: { type: DataTypes.STRING, allowNull: false },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { isEmail: true },
      },
      phone: { type: DataTypes.STRING },
      biography: { type: DataTypes.TEXT },
      nationality: { type: DataTypes.STRING },
      country: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      address: { type: DataTypes.STRING, allowNull: true },
      countryOfResidence: { type: DataTypes.STRING, allowNull: true },

      // Individual fields
      gender: {
        type: DataTypes.ENUM("male", "female", "other", "prefer-not-to-say"),
        allowNull: true,
        set(v) {
          // turn "", null, undefined into NULL in DB
          this.setDataValue("gender", v && String(v).trim() ? v : null);
        },
      },

      // Company fields
      otherCountries: { type: DataTypes.JSON, allowNull: true }, // Array of countries
      webpage: { type: DataTypes.STRING, allowNull: true },

      // 🔑 password
      passwordHash: { type: DataTypes.STRING, allowNull: false },

      // 🔀 Account type: only “individual” or “company”
      accountType: {
        type: DataTypes.ENUM("individual", "company","admin"),
        allowNull: false,
        defaultValue: "individual",
      },

      isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },

      provider: { type: DataTypes.ENUM("local", "google"), allowNull: false, defaultValue: "local" },
       googleId: { type: DataTypes.STRING(64), allowNull: true },
       avatarUrl: { type: DataTypes.TEXT('long'), allowNull: true},

    },
    {
      tableName: "users",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["email"] },
        { fields: ["countryOfResidence"] },
        { unique: true, fields: ["googleId"] },
      ],
    }
  );


  
  return User;
};
