// src/models/profile.js
const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Profile = sequelize.define(
    "Profile",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true, // one Profile per User
      },

      // FR-5: Primary Identity
      // IMPORTANT: Frontend must send one of these EXACT values
      primaryIdentity: {
        type: DataTypes.STRING ,
        allowNull: true,
      },

      // Optional “featured” industry/subindustry (you still can keep M2M tables for multi-select)
      categoryId:    { type: DataTypes.UUID, allowNull: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: true },

      onboardingDone:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // Onboarding flags
      onboardingProfileTypeDone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      onboardingCategoriesDone:  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      onboardingGoalsDone:       { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // Extended profile (NO duplicates with User)
      birthDate:         { type: DataTypes.DATEONLY, allowNull: true },
      professionalTitle: { type: DataTypes.STRING(140), allowNull: true },
      about:             { type: DataTypes.TEXT, allowNull: true },
      avatarUrl:         { type: DataTypes.TEXT("long"), allowNull: true },

      experienceLevel: {
        type: DataTypes.ENUM("Junior", "Mid", "Senior", "Lead", "Director", "C-level"),
        allowNull: true,
      },
      skills:    { type: DataTypes.JSON, allowNull: true, defaultValue: [] }, // ["React", "Node.js"]
      languages: { type: DataTypes.JSON, allowNull: true, defaultValue: [] }, // [{ name, level }]

      // Portfolio/Showcase fields
      cvBase64: { type: DataTypes.JSON, allowNull: true, defaultValue: [] }, // Array of CV objects: [{original_filename, title, base64}]

      // Job availability status
      isOpenToWork: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // Indicates if user is open to work opportunities
    },
    { tableName: "profiles", timestamps: true }
  );

  return Profile;
};
