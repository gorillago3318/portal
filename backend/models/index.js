// models/index.js
const sequelize = require('../config/db'); // This is your db.js from config
const AgentClass = require('./agent');
const LeadClass = require('./lead');
const CommissionClass = require('./commissions');

// 1) Initialize each model
const Agent = AgentClass.initModel(sequelize);
const Lead = LeadClass.initModel(sequelize);
const Commission = CommissionClass.initModel(sequelize);

// 2) Put them in an object so we can .associate later
const models = { Agent, Lead, Commission };

// 3) For each model, call .associate(models) if it exists
Object.keys(models).forEach((modelName) => {
  // modelName will be "Agent", "Lead", "Commission"
  // e.g. models["Agent"] = Agent
  if (typeof models[modelName].associate === 'function') {
    models[modelName].associate(models);
  }
});

// 4) Export the models + sequelize
module.exports = {
  sequelize,
  Agent,
  Lead,
  Commission,
};
