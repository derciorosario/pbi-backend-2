const { sequelize } = require('../src/models');

async function addCompanyFieldsToUsers() {
  try {
    console.log('Adding company relationship fields to users table...');

    // Add isCompanyRepresentative field
    await sequelize.getQueryInterface().addColumn('users', 'isCompanyRepresentative', {
      type: sequelize.Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    console.log('✅ Added isCompanyRepresentative column');

    // Add companyRepresentativeFor field
    await sequelize.getQueryInterface().addColumn('users', 'companyRepresentativeFor', {
      type: sequelize.Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    });
    console.log('✅ Added companyRepresentativeFor column');

    // Add representativeAuthorizedAt field
    await sequelize.getQueryInterface().addColumn('users', 'representativeAuthorizedAt', {
      type: sequelize.Sequelize.DATE,
      allowNull: true
    });
    console.log('✅ Added representativeAuthorizedAt column');

    // Add representativeRevokedAt field
    await sequelize.getQueryInterface().addColumn('users', 'representativeRevokedAt', {
      type: sequelize.Sequelize.DATE,
      allowNull: true
    });
    console.log('✅ Added representativeRevokedAt column');

    // Add isCompanyStaff field
    await sequelize.getQueryInterface().addColumn('users', 'isCompanyStaff', {
      type: sequelize.Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
    console.log('✅ Added isCompanyStaff column');

    // Add staffOfCompany field
    await sequelize.getQueryInterface().addColumn('users', 'staffOfCompany', {
      type: sequelize.Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    });
    console.log('✅ Added staffOfCompany column');

    // Add staffRole field
    await sequelize.getQueryInterface().addColumn('users', 'staffRole', {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true
    });
    console.log('✅ Added staffRole column');

    // Add staffJoinedAt field
    await sequelize.getQueryInterface().addColumn('users', 'staffJoinedAt', {
      type: sequelize.Sequelize.DATE,
      allowNull: true
    });
    console.log('✅ Added staffJoinedAt column');

    // Add staffLeftAt field
    await sequelize.getQueryInterface().addColumn('users', 'staffLeftAt', {
      type: sequelize.Sequelize.DATE,
      allowNull: true
    });
    console.log('✅ Added staffLeftAt column');

    console.log('✅ All company relationship fields added successfully');
    return true;
  } catch (error) {
    console.error('❌ Error adding company fields:', error);
    return false;
  }
}

module.exports = { addCompanyFieldsToUsers };

// Run if called directly
if (require.main === module) {
  addCompanyFieldsToUsers()
    .then((success) => {
      if (success) {
        console.log('✅ Migration completed successfully');
        process.exit(0);
      } else {
        console.error('❌ Migration failed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ Migration error:', error);
      process.exit(1);
    });
}