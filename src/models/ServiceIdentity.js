// models/ServiceIdentity.js
module.exports = (sequelize, DataTypes) => {
  const ServiceIdentity = sequelize.define(
    "ServiceIdentity",
    {
      serviceId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      identityId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    },
    { tableName: "service_identities", timestamps: false }
  );
  return ServiceIdentity;
};