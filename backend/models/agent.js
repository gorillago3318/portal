const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Ensure correct path to your db configuration

class Agent extends Model {}

Agent.initModel = (sequelize, DataTypes) => {
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
                validate: {
                    isEmail: { msg: 'Invalid email address' },
                },
            },
            location: {
                type: DataTypes.STRING,
                allowNull: true,
                defaultValue: 'Unknown',
            },
            status: {
                type: DataTypes.ENUM('Active', 'Inactive', 'Pending', 'Rejected'),
                defaultValue: 'Pending',
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
            ],
            hooks: {
                beforeCreate: async (agent) => {
                    // Log to debug if referral code is being set correctly
                    console.log('BeforeCreate Hook - Setting referral_code for new agent');
                    if (!agent.referral_code) {
                        agent.referral_code = `REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
                    }
                },
                beforeUpdate: (agent) => {
                    // Log to debug if update is triggering unnecessarily
                    console.log('BeforeUpdate Hook - Checking if referral_code has changed');
                    if (agent.changed('referral_code')) {
                        console.log('Referral code is being updated, which should not happen!');
                        throw new Error('Referral code cannot be updated.');
                    }
                },
            },
        }
    );
};

module.exports = Agent;
