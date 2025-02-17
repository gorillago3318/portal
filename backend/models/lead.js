// models/lead.js
const { Model, DataTypes } = require('sequelize');

class Lead extends Model {
  static initModel(sequelize) {
    console.log('[DEBUG][Lead.initModel] Initializing Lead model...');

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
          allowNull: true,
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
        // NEW FIELDS
        monthly_savings: {
          type: DataTypes.DECIMAL(15, 2),
          defaultValue: 0,
          validate: {
            isDecimal: { msg: 'Monthly savings must be a valid decimal' },
            min: { args: [0], msg: 'Monthly savings cannot be negative' },
          },
        },
        yearly_savings: {
          type: DataTypes.DECIMAL(15, 2),
          defaultValue: 0,
          validate: {
            isDecimal: { msg: 'Yearly savings must be a valid decimal' },
            min: { args: [0], msg: 'Yearly savings cannot be negative' },
          },
        },
        new_monthly_repayment: {
          type: DataTypes.DECIMAL(15, 2),
          defaultValue: 0,
          validate: {
            isDecimal: { msg: 'New monthly repayment must be a valid decimal' },
            min: { args: [0], msg: 'New monthly repayment cannot be negative' },
          },
        },
        bankname: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        // END NEW FIELDS
        status: {
          type: DataTypes.ENUM(
            'New',
            'Contacted',
            'Preparing Documents',
            'Submitted',
            'Approved',
            'KIV',
            'Rejected',
            'Accepted/Decline/Appeal'
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
        paranoid: true,
        indexes: [
          { fields: ['status'] },
          { fields: ['assigned_agent_id'] },
        ],
        hooks: {
          beforeCreate: async (lead) => {
            console.log('[DEBUG][Lead.beforeCreate] Generating unique_id for lead:', lead.name || '(no name)');

            const latestLead = await Lead.findOne({
              attributes: ['unique_id'],
              where: { deletedAt: null },
              order: [['createdAt', 'DESC']],
            });

            const lastId = latestLead && latestLead.unique_id
              ? parseInt(latestLead.unique_id.split('.')[0], 10)
              : 0;

            console.log(
              '[DEBUG][Lead.beforeCreate] Found latestLead unique_id:',
              latestLead?.unique_id || 'None',
              '-> lastId:',
              lastId
            );

            lead.unique_id = `${lastId + 1}.0.0.0`;
            console.log('[DEBUG][Lead.beforeCreate] New unique_id:', lead.unique_id);
          },
        },
      }
    );

    return Lead; // Return the model after initialization
  }

  static associate(models) {
    console.log('[DEBUG][Lead.associate] Setting up associations...');
    Lead.belongsTo(models.Agent, {
      as: 'agent',
      foreignKey: 'assigned_agent_id',
    });
    Lead.belongsTo(models.Agent, {
      as: 'referrer',
      foreignKey: 'referrer_id',
    });
  }
}

module.exports = Lead;
