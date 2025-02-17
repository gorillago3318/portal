const { Model, DataTypes } = require('sequelize');

class Commission extends Model {
  static initModel(sequelize) {
    Commission.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        lead_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'Leads',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        agent_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'Agents',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        referrer_id: {
          type: DataTypes.UUID,
          allowNull: true,
          references: {
            model: 'Agents',
            key: 'id',
          },
          onDelete: 'SET NULL',
        },
        loan_amount: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          validate: {
            isDecimal: { msg: 'Loan amount must be a valid decimal' },
            min: { args: [0], msg: 'Loan amount cannot be negative' },
          },
        },
        max_commission: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: false,
          validate: {
            isDecimal: { msg: 'Max commission must be a valid decimal' },
            min: { args: [0], msg: 'Max commission cannot be negative' },
          },
        },
        referrer_commission: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          defaultValue: 0.0,
          validate: {
            isDecimal: { msg: 'Referrer commission must be a valid decimal' },
            min: { args: [0], msg: 'Referrer commission cannot be negative' },
          },
        },
        agent_commission: {
          type: DataTypes.DECIMAL(15, 2),
          allowNull: true,
          defaultValue: 0.0,
          validate: {
            isDecimal: { msg: 'Agent commission must be a valid decimal' },
            min: { args: [0], msg: 'Agent commission cannot be negative' },
          },
        },
        status: {
          type: DataTypes.ENUM('Pending', 'Paid'),
          allowNull: false,
          defaultValue: 'Pending',
          validate: {
            isIn: {
              args: [['Pending', 'Paid']],
              msg: 'Status must be either "Pending" or "Paid"',
            },
          },
        },
      },
      {
        sequelize,
        modelName: 'Commission',
        tableName: 'Commissions',
        timestamps: true,
        paranoid: true,
        indexes: [
          { fields: ['lead_id'] },
          { fields: ['agent_id'] },
          { fields: ['referrer_id'] },
          { fields: ['lead_id', 'agent_id', 'referrer_id'] },
        ],
        hooks: {
          beforeValidate: (commission) => {
            if (!commission.max_commission) {
              // Default: 0.3% of loan_amount
              commission.max_commission = commission.loan_amount * 0.003;
            }
          },
        },
      }
    );

    return Commission;
  }

  static associate(models) {
    // Each commission belongs to a lead.
    Commission.belongsTo(models.Lead, {
      foreignKey: 'lead_id',
      as: 'lead',
    });
    // Each commission belongs to an agent.
    Commission.belongsTo(models.Agent, {
      foreignKey: 'agent_id',
      as: 'agent',
    });
    // If available, each commission belongs to a referrer.
    Commission.belongsTo(models.Agent, {
      foreignKey: 'referrer_id',
      as: 'referrer',
    });
  }
}

module.exports = Commission;
