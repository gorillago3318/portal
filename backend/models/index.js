const sequelize = require('../config/db'); // This is your db.js from config
const AgentClass = require('./agent');
const LeadClass = require('./lead');
const CommissionClass = require('./commissions');

// Debug: Log the sequelize instance to ensure connection is set
console.log('[DEBUG] Sequelize instance initialized:', sequelize);

// 1) Initialize each model
const Agent = AgentClass.initModel(sequelize);
const Lead = LeadClass.initModel(sequelize);
const Commission = CommissionClass.initModel(sequelize);

// Debug: Log model initialization
console.log('[DEBUG] Models initialized:');
console.log('[DEBUG] Agent model:', Agent);
console.log('[DEBUG] Lead model:', Lead);
console.log('[DEBUG] Commission model:', Commission);

// 2) Put them in an object so we can .associate later
const models = { Agent, Lead, Commission };

// 3) For each model, call .associate(models) if it exists
console.log('[DEBUG] Associating models...');
Object.keys(models).forEach((modelName) => {
  if (typeof models[modelName].associate === 'function') {
    console.log(`[DEBUG] Associating model: ${modelName}`);
    models[modelName].associate(models);
  }
});

// Debug: Confirm associations completed
console.log('[DEBUG] Model associations completed.');

// 4) Export the models + sequelize
console.log('[DEBUG] Exporting models and sequelize instance.');
module.exports = {
  sequelize,
  Agent,
  Lead,
  Commission,
};
