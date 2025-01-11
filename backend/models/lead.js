const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Agent = require('./agent'); // Import the Agent model

const Lead = sequelize.define(
    'Lead',
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        unique_id: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: true, // Allow null for flexibility
            validate: {
                is: {
                    args: /^\d+\.\d+\.\d+\.\d+$/,
                    msg: 'Unique ID must follow the format X.X.X.X',
                },
            },
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isNumeric: true,
                len: [10, 15],
            },
        },
        loan_amount: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
            validate: {
                isDecimal: true,
                min: 0,
            },
        },
        estimated_savings: {
            type: DataTypes.DECIMAL(15, 2),
            defaultValue: 0,
            validate: {
                isDecimal: true,
                min: 0,
            },
        },
        status: {
            type: DataTypes.ENUM(
                'New',
                'Contacted',
                'Preparing Documents',
                'Submitted',
                'Approved',
                'Declined',
                'KIV',
                'Accepted',
                'Rejected'
            ),
            defaultValue: 'New',
        },
        assigned_agent_id: {
            type: DataTypes.UUID,
            allowNull: true,
            validate: {
                isUUID: {
                    args: 4,
                    msg: 'Assigned agent ID must be a valid UUID',
                },
            },
        },
    },
    {
        timestamps: true,
        paranoid: true,
        tableName: 'Leads',
        indexes: [
            {
                fields: ['status'],
            },
            {
                fields: ['assigned_agent_id'],
            },
        ],
        hooks: {
            beforeCreate: async (lead) => {
                const latestLead = await Lead.findOne({
                    attributes: ['unique_id'],
                    where: { deletedAt: null }, // Exclude soft-deleted records
                    order: [['createdAt', 'DESC']],
                });
                const lastId = latestLead ? latestLead.unique_id.split('.')[0] : 0;
                lead.unique_id = `${parseInt(lastId, 10) + 1}.0.0.0`;
            },
        },
    }
);

// Define the association
Lead.belongsTo(Agent, { as: 'agent', foreignKey: 'assigned_agent_id' });

module.exports = Lead;
