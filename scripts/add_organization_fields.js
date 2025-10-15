const { sequelize } = require('../src/models');

async function addOrganizationFields() {
  try {
    console.log('🔄 Adding organization fields to users table...');

    // Add organizationId column
    await sequelize.getQueryInterface().addColumn('users', 'organizationId', {
      type: sequelize.Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      comment: "Organization this user belongs to (for individual users)"
    });

    // Add organizationRole column
    await sequelize.getQueryInterface().addColumn('users', 'organizationRole', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
      comment: "Role/position within the organization"
    });

    // Add organizationJoinedAt column
    await sequelize.getQueryInterface().addColumn('users', 'organizationJoinedAt', {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
      comment: "When user joined the organization"
    });

    console.log('✅ Organization fields added successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error adding organization fields:', error);
    return false;
  }
}

// Run migration if this script is called directly
if (require.main === module) {
  addOrganizationFields()
    .then((success) => {
      if (success) {
        console.log('🎉 Migration completed successfully!');
        process.exit(0);
      } else {
        console.error('💥 Migration failed!');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { addOrganizationFields };