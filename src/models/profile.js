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
        type: DataTypes.STRING,
        allowNull: true,
        set(v) {
          this.setDataValue("primaryIdentity", v && String(v).trim() ? v : null);
        },
      },

      // Optional "featured" industry/subindustry (you still can keep M2M tables for multi-select)
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        set(v) {
          this.setDataValue("categoryId", v && String(v).trim() ? v : null);
        },
      },
      subcategoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        set(v) {
          this.setDataValue("subcategoryId", v && String(v).trim() ? v : null);
        },
      },

      onboardingDone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // Onboarding flags
      onboardingProfileTypeDone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      onboardingCategoriesDone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      onboardingGoalsDone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      // Extended profile (NO duplicates with User)
      birthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        set(v) {
          this.setDataValue("birthDate", v && String(v).trim() ? v : null);
        },
      },
      professionalTitle: {
        type: DataTypes.STRING(140),
        allowNull: true,
        set(v) {
          this.setDataValue("professionalTitle", v && String(v).trim() ? v : null);
        },
      },
      about: {
        type: DataTypes.TEXT,
        allowNull: true,
        set(v) {
          this.setDataValue("about", v && String(v).trim() ? v : null);
        },
      },
      avatarUrl: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        set(v) {
          this.setDataValue("avatarUrl", v && String(v).trim() ? v : null);
        },
      },

      experienceLevel: {
        type: DataTypes.ENUM("Junior", "Mid", "Senior", "Lead", "Director", "C-level"),
        allowNull: true,
        set(v) {
          this.setDataValue("experienceLevel", v && String(v).trim() ? v : null);
        },
      },
      skills: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        set(v) {
          this.setDataValue("skills", v && (Array.isArray(v) ? v : String(v).trim()) ? v : null);
        },
      },
      languages: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        set(v) {
          this.setDataValue("languages", v && (Array.isArray(v) ? v : String(v).trim()) ? v : null);
        },
      },

      // Portfolio/Showcase fields
      cvBase64: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        set(v) {
          this.setDataValue("cvBase64", v && (Array.isArray(v) ? v : String(v).trim()) ? v : null);
        },
      },

      // Job availability status
      isOpenToWork: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: "profiles", timestamps: true }
  );

  return Profile;
};