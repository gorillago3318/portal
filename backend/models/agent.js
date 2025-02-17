// models/agent.js
const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class Agent extends Model {}

Agent.initModel = (sequelize) => {
  Agent.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: { args: [2, 50], msg: 'Name must be between 2 and 50 characters' },
          notEmpty: { msg: 'Name cannot be empty' },
        },
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: {
          name: 'unique_phone',
          msg: 'This phone number is already in use.',
        },
        validate: {
          is: { args: /^\d+$/, msg: 'Phone number must contain only digits' },
          len: { args: [10, 15], msg: 'Phone number must be between 10 and 15 digits' },
        },
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        unique: {
          name: 'unique_email',
          msg: 'This email is already in use.',
        },
        validate: {
          isEmail: { msg: 'Invalid email address' },
        },
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'Unknown',
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: { args: [8, 100], msg: 'Password must be at least 8 characters long' },
        },
      },
      status: {
        type: DataTypes.ENUM('Active', 'Inactive', 'Pending', 'Rejected'),
        defaultValue: 'Pending', // For self-registration; Admin endpoints can override to Active.
      },
      referral_code: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: {
          name: 'unique_referral_code',
          msg: 'Referral code must be unique',
        },
      },
      role: {
        type: DataTypes.ENUM('Admin', 'Agent', 'Referrer'),
        defaultValue: 'Agent',
      },
      parent_referrer_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'Agents',
          key: 'id',
        },
        onDelete: 'SET NULL',
      },
      bank_name: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: { args: [2, 100], msg: 'Bank name must be between 2 and 100 characters' },
        },
      },
      account_number: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          is: { args: /^\d+$/, msg: 'Account number must contain only digits' },
          len: { args: [5, 30], msg: 'Account number must be between 5 and 30 characters' },
        },
      },
      reset_password_token: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Agent',
      tableName: 'Agents',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['phone'] },
        { fields: ['status'] },
        { fields: ['referral_code'] },
        { fields: ['email'] },
        { fields: ['role'] },
      ],
      hooks: {
        beforeCreate: async (agent) => {
          console.log('[DEBUG] Agent.beforeCreate Hook Triggered');
          try {
            // Referral Code Generation: if not provided, generate a unique referral code.
            if (!agent.referral_code) {
              console.log('[DEBUG] Generating referral code');
              let isUnique = false;
              while (!isUnique) {
                const generatedCode = `REF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                console.log(`[DEBUG] Generated referral code candidate: ${generatedCode}`);

                const existing = await Agent.findOne({ where: { referral_code: generatedCode }, paranoid: false });
                if (!existing) {
                  agent.referral_code = generatedCode;
                  isUnique = true;
                  console.log(`[DEBUG] Set unique referral code: ${agent.referral_code}`);
                } else {
                  console.log(`[DEBUG] Referral code collision detected: ${generatedCode}`);
                }
              }
            }

            // Password Hashing: Only hash if password isn't already hashed.
            if (agent.password && !agent.password.startsWith('$2b$')) {
              console.log('[DEBUG] Hashing password in beforeCreate hook');
              agent.password = await bcrypt.hash(agent.password, 10);
            }
          } catch (hookError) {
            console.error('[ERROR] Error in beforeCreate hook:', hookError);
            throw hookError;
          }
        },

        beforeUpdate: async (agent) => {
          console.log('[DEBUG] Agent.beforeUpdate Hook Triggered');
          try {
            // Prevent Referral Code Updates.
            if (agent.changed('referral_code')) {
              console.log('[ERROR] Referral code update attempted:', agent.referral_code);
              throw new Error('Referral code cannot be updated.');
            }

            // Password Hashing: If password field has changed and is not already hashed.
            if (agent.changed('password') && !agent.password.startsWith('$2b$')) {
              console.log('[DEBUG] Hashing updated password in beforeUpdate hook');
              agent.password = await bcrypt.hash(agent.password, 10);
              console.log('[DEBUG] Password hashed in beforeUpdate hook');
            }
          } catch (hookError) {
            console.error('[ERROR] Error in beforeUpdate hook:', hookError);
            throw hookError;
          }
        },
      },
    }
  );

  return Agent;
};

Agent.associate = (models) => {
  // For example: an agent can have many leads assigned to them.
  // Agent.hasMany(models.Lead, { as: 'leads', foreignKey: 'assigned_agent_id' });
};

module.exports = Agent;
