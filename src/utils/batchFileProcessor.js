// backend/src/utils/batchFileProcessor.js
require('dotenv').config();
const { processModelFiles } = require('./fileProcessor'); // the helper
const db = require('../models'); // Sequelize models

// List of models to process
const modelsToProcess = [
  { model: db.User, type: 'user' },
  { model: db.Job, type: 'job' },
  { model: db.Profile, type: 'profile' },
  { model: db.WorkSample, type: 'workSample' },
  { model: db.Event, type: 'event' },
  { model: db.Product, type: 'product' },
  { model: db.Service, type: 'service' },
  { model: db.Tourism, type: 'tourism' },
  { model: db.Funding, type: 'funding' },
  { model: db.Moment, type: 'moment' },
  { model: db.Need, type: 'need' },
];

async function processAll() {
  for (const entry of modelsToProcess) {
    const { model, type } = entry;

    console.log(`Processing model: ${type}`);

    const items = await model.findAll();

    for (const item of items) {
      let data = item.toJSON();

      // Add type for processModelFiles
      data.type = type;

      // Process all file fields
      data = await processModelFiles(data);

      // Remove type before updating DB
      delete data.type;

      // Update in DB
      await model.update(data, { where: { id: item.id } });
    }

    console.log(`Finished processing model: ${type}`);
  }

  console.log('✅ All models processed successfully!');
}

// Run the batch processor
processAll()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error in batch processing:', err);
    process.exit(1);
});
