const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Adjust path to match your project structure

// Import models
const Agent = require('./agent');
const Lead = require('./lead');
const Commission = require('./commissions');

// Initialize models
Agent.initModel(sequelize, DataTypes);
Lead.initModel(sequelize, DataTypes);
Commission.initModel(sequelize, DataTypes);

// Define associations
Lead.hasMany(Commission, { foreignKey: 'lead_id', onDelete: 'CASCADE' });
Commission.belongsTo(Lead, { foreignKey: 'lead_id' });

Agent.hasMany(Commission, { foreignKey: 'agent_id', onDelete: 'CASCADE' });
Commission.belongsTo(Agent, { foreignKey: 'agent_id' });

Agent.hasMany(Commission, { foreignKey: 'referrer_id', onDelete: 'SET NULL' });
Commission.belongsTo(Agent, { foreignKey: 'referrer_id' });

// Export models and Sequelize instance
module.exports = { sequelize, Agent, Lead, Commission };
