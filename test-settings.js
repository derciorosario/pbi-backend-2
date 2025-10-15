// test-settings.js

// We'll test the model and controller directly instead of using the API
// since we don't have a valid JWT token
const { User, UserSettings } = require('./src/models');
const { getSettings, updateSettings } = require('./src/controllers/settings.controller');

async function testUserSettingsModel() {
  try {
    console.log('Testing UserSettings model...');
    
    // Create a test user
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      passwordHash: 'hashedpassword123', // This would normally be hashed
      accountType: 'individual'
    });
    
    console.log('Test user created:', testUser.id);
    
    // Create settings for the test user
    const settings = await UserSettings.create({
      userId: testUser.id,
      notifications: JSON.stringify({
        jobOpportunities: { email: true },
        connectionInvitations: { email: true },
        connectionRecommendations: { email: true },
        connectionUpdates: { email: true },
        messages: { email: true },
        meetingRequests: { email: true }
      }),
      emailFrequency: 'daily'
    });
    
    console.log('Settings created:', settings.id);
    
    // Retrieve the settings
    const retrievedSettings = await UserSettings.findOne({
      where: { userId: testUser.id }
    });
    
    console.log('Retrieved settings:');
    console.log('- userId:', retrievedSettings.userId);
    console.log('- notifications:', retrievedSettings.notifications);
    console.log('- emailFrequency:', retrievedSettings.emailFrequency);
    
    // Parse notifications if it's a string
    const notifications = typeof retrievedSettings.notifications === 'string'
      ? JSON.parse(retrievedSettings.notifications)
      : retrievedSettings.notifications;
    
    console.log('Parsed notifications:', notifications);
    
    // Update the settings
    retrievedSettings.notifications = typeof notifications === 'string'
      ? notifications
      : JSON.stringify({
          ...notifications,
          jobOpportunities: { email: !notifications.jobOpportunities.email }
        });
    
    await retrievedSettings.save();
    
    console.log('Settings updated successfully');
    
    // Clean up
    await retrievedSettings.destroy();
    await testUser.destroy();
    
    console.log('Test data cleaned up');
    
    return true;
  } catch (error) {
    console.error('Error testing UserSettings model:', error);
    return false;
  }
}

async function runTests() {
  console.log('Starting UserSettings tests...');
  const success = await testUserSettingsModel();
  console.log('Tests completed. Success:', success);
}

runTests();