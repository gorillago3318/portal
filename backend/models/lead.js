const { Model, DataTypes } = require('sequelize');
const Agent = require('./agent'); // Import the Agent model

class Lead extends Model {
    static initModel(sequelize) {
        Lead.init(
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
                            args: /^\d+\.\d+\.\d+\.\d+$/, // Format validation: X.X.X.X
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
                        isNumeric: { msg: 'Phone must contain only numbers' },
                        len: { args: [10, 15], msg: 'Phone number must be between 10 and 15 digits' },
                    },
                },
                loan_amount: {
                    type: DataTypes.DECIMAL(15, 2),
                    defaultValue: 0,
                    validate: {
                        isDecimal: { msg: 'Loan amount must be a valid decimal' },
                        min: { args: [0], msg: 'Loan amount cannot be negative' },
                    },
                },
                estimated_savings: {
                    type: DataTypes.DECIMAL(15, 2),
                    defaultValue: 0,
                    validate: {
                        isDecimal: { msg: 'Estimated savings must be a valid decimal' },
                        min: { args: [0], msg: 'Estimated savings cannot be negative' },
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
                    references: {
                        model: 'Agents',
                        key: 'id',
                    },
                },
                referrer_id: {
                    type: DataTypes.UUID,
                    allowNull: true,
                    references: {
                        model: 'Agents',
                        key: 'id',
                    },
                },
                source: {
                    type: DataTypes.STRING,
                    defaultValue: 'Direct',
                },
            },
            {
                sequelize,
                modelName: 'Lead',
                tableName: 'Leads',
                timestamps: true,
                paranoid: true, // Enables soft deletes
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
                        // Generate unique_id using the last one in the database (X.X.X.X format)
                        const latestLead = await Lead.findOne({
                            attributes: ['unique_id'],
                            where: { deletedAt: null }, // Exclude soft-deleted records
                            order: [['createdAt', 'DESC']],
                        });
                        const lastId = latestLead ? parseInt(latestLead.unique_id.split('.')[0], 10) : 0;
                        lead.unique_id = `${lastId + 1}.0.0.0`;
                    },
                },
            }
        );
    }
}

// Define the associations
Lead.associate = (models) => {
    // One lead is assigned to one agent
    Lead.belongsTo(models.Agent, { as: 'assignedAgent', foreignKey: 'assigned_agent_id' });

    // One lead can be referred by one agent (referrer)
    Lead.belongsTo(models.Agent, { as: 'referrer', foreignKey: 'referrer_id' });
};

module.exports = Lead;
