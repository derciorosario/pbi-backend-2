module.exports = (sequelize, DataTypes) => {
  const JobSubcategory = sequelize.define(
    "JobSubcategory",
    {
      jobId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subcategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "job_subcategories", timestamps: false }
  );
  return JobSubcategory;
};