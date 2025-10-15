// models/JobIdentity.js
module.exports = (sequelize, DataTypes) => {
  const JobIdentity = sequelize.define(
    "JobIdentity",
    {
      jobId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "job_identities", timestamps: false }
  );
  return JobIdentity;
};
