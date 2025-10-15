const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const JobApplication = sequelize.define(
    "JobApplication",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },

      // Applicant
      userId: { type: DataTypes.UUID, allowNull: false },

      // Job
      jobId: { type: DataTypes.UUID, allowNull: false },

      // Application details
      coverLetter: { type: DataTypes.TEXT, allowNull: false },
      expectedSalary: { type: DataTypes.STRING(100), allowNull: true },
      availability: {
        type: DataTypes.ENUM("immediate", "1month", "specific"),
        allowNull: true
      },
      availabilityDate: { type: DataTypes.DATEONLY, allowNull: true },
      employmentType: {
        type: DataTypes.ENUM("full-time", "part-time", "contract", "internship", "remote", "hybrid", "onsite"),
        allowNull: true
      },

      // CV/Resume data
      cvBase64: { type: DataTypes.JSON, allowNull: true }, // CV data: {original_filename, title, base64, created_at}

      // Status
      status: {
        type: DataTypes.ENUM("pending", "reviewed", "accepted", "rejected"),
        defaultValue: "pending"
      },
    },
    {
      tableName: "job_applications",
      timestamps: true,
      indexes: [{ fields: ["userId", "jobId"] }],
    }
  );

  JobApplication.associate = (models) => {
    JobApplication.belongsTo(models.User, {
      as: "applicant",
      foreignKey: "userId",
      onDelete: "CASCADE",
    });
    JobApplication.belongsTo(models.Job, {
      as: "job",
      foreignKey: "jobId",
      onDelete: "CASCADE",
    });
  };

  return JobApplication;
};