module.exports = (sequelize, DataTypes) => {
  const JobSubsubCategory = sequelize.define(
    "JobSubsubCategory",
    {
      jobId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      subsubCategoryId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "job_subsubcategories", timestamps: false }
  );
  return JobSubsubCategory;
};
