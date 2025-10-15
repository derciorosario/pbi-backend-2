module.exports = (sequelize, DataTypes) => {
  const JobCategory = sequelize.define(
    "JobCategory",
    {
      jobId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      categoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "job_categories", timestamps: false }
  );
  return JobCategory;
};