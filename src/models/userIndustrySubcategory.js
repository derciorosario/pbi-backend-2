const { v4: uuidv4 } = require("uuid");

module.exports = (sequelize, DataTypes) => {
  const UserIndustrySubcategory = sequelize.define(
    "UserIndustrySubcategory",
    {
      id: { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      industrySubcategoryId: { type: DataTypes.UUID, allowNull: false },
    },
    {
      tableName: "user_industry_subcategories",
      timestamps: true,
      indexes: [{ fields: ["userId", "industrySubcategoryId"], unique: true }],
    }
  );

  // Add the associations
  UserIndustrySubcategory.associate = (models) => {
    UserIndustrySubcategory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    UserIndustrySubcategory.belongsTo(models.IndustrySubcategory, {
      foreignKey: 'industrySubcategoryId',
      as: 'industrySubcategory'
    });
  };

  return UserIndustrySubcategory;
};
