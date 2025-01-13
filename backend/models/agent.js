const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Agent = sequelize.define(
    'Agent',
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
                len: [2, 50], // Name must be between 2 and 50 characters
                notEmpty: true, // Ensure name is not empty
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
                is: /^\d+$/, // Ensure phone contains only digits
                len: [10, 15], // Length validation
            },
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            validate: {
                isEmail: true,
            },
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'Unknown',
        },
        status: {
            type: DataTypes.ENUM('Active', 'Inactive', 'Pending', 'Rejected'), // Added 'Rejected' status
            defaultValue: 'Pending',
        },
        referral_code: {
            type: DataTypes.STRING,
            allowNull: true, // Allow NULL for database-level flexibility
            unique: true, // Ensure referral_code is unique
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
        },
        bank_name: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                len: [2, 100], // Ensure bank name is valid
            },
        },
        account_number: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                is: /^\d+$/, // Ensure account number contains only digits
                len: [5, 30], // Reasonable length validation
            },
        },
    },
    {
        timestamps: true,
        paranoid: true, // Enables soft deletes
        tableName: 'Agents',
        indexes: [
            {
                fields: ['phone'], // Index for phone
            },
            {
                fields: ['status'], // Index for status
            },
            {
                fields: ['referral_code'], // Index for referral_code
            },
        ],
        hooks: {
            beforeCreate: async (agent) => {
                if (!agent.referral_code) {
                    agent.referral_code = `REF-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
                }
            },
            beforeUpdate: (agent) => {
                if (agent.changed('referral_code')) {
                    throw new Error('Referral code cannot be updated.');
                }
            },
        },
    }
);

module.exports = Agent;
