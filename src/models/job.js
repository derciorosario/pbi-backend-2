const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define(
    "Job",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      countries: { type: DataTypes.JSON, allowNull: true, defaultValue:[]}, // [{city,county}]

      // Basic
      title:          { type: DataTypes.STRING(180), allowNull: false },
      companyName:    { type: DataTypes.STRING(180), allowNull: false },
      // New: selected company user id (accounts having accountType = "company")
      companyId: { type: DataTypes.UUID, allowNull: true },
      make_company_name_private: { type: DataTypes.BOOLEAN, defaultValue: false },
      department:     { type: DataTypes.STRING(120) },
      experienceLevel:{ type: DataTypes.ENUM("Junior","Mid-level","Senior","Lead"), allowNull: true,

        set(v) {
          // turn "", null, undefined into NULL in DB
          this.setDataValue("experienceLevel", v && String(v).trim() ? v : null);
        },

      },

      //new Fields here - Details
     
      jobType: {
        type: DataTypes.STRING(), // e.g. "Full-Time"
        allowNull: false,
      },

      workLocation: {
        type: DataTypes.STRING(), // e.g. "Remote"
        allowNull: true,
      },

      workSchedule: {
        type: DataTypes.STRING(), // e.g. "Day Shift"
        allowNull: true,
      },

      careerLevel: {
        type: DataTypes.STRING(), // e.g. "Entry-Level"
        allowNull: true,
      },

      paymentType: {
        type: DataTypes.STRING(), // e.g. "Salaried Jobs"
        allowNull: true,
      },
         /*** end of new fields */

      description:    { type: DataTypes.TEXT, allowNull: false },
      requiredSkills: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },

      // Location & Compensation
      country:        { type: DataTypes.STRING(80), allowNull: false },
      city:           { type: DataTypes.STRING(120) },
      minSalary:      { type: DataTypes.DECIMAL(12,2), allowNull: true },
      maxSalary:      { type: DataTypes.DECIMAL(12,2), allowNull: true },
      currency:       { type: DataTypes.STRING(10), allowNull: true }, // e.g. USD, NGN, ZAR...

      benefits:      { type: DataTypes.STRING(500) },

      
      // Application
      applicationDeadline:   { type: DataTypes.DATEONLY,  set(v) {
          // turn "", null, undefined into NULL in DB
          this.setDataValue("applicationDeadline", v && String(v).trim() ? v : null);
        }, },
      positions:             { type: DataTypes.INTEGER, defaultValue: 1 },
      applicationInstructions:{ type: DataTypes.TEXT },
      contactEmail:          { type: DataTypes.STRING(160) },

      // Associations
      postedByUserId: { type: DataTypes.UUID, allowNull: false },
      categoryId:     { type: DataTypes.UUID, allowNull: true },      // industry
      subcategoryId:  { type: DataTypes.UUID, allowNull: true },       // optional


      status:         { type: DataTypes.ENUM("draft","published"), defaultValue: "published" },
      
      moderation_status: {
        type: DataTypes.ENUM("approved", "reported", "under_review", "removed", "suspended"),
        defaultValue: "approved"
      },

      coverImageBase64: { type: DataTypes.TEXT('long'), allowNull: true },
    },
    {
      tableName: "jobs",
      timestamps: true,
      indexes: [{ fields: ["postedByUserId", "categoryId", "subcategoryId"] }],
    }
  );

  Job.associate = (models) => {
    // New association to the company user (accountType: "company")
     // ✅ NEW: link a Job to a company User via jobs.companyId
    Job.belongsTo(models.User, {
      as: "company",
      foreignKey: { name: "companyId", allowNull: true },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
  };

  return Job;
};
