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
            type: DataTypes.ENUM('Active', 'Inactive'),
            defaultValue: 'Active',
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
        ],
        hooks: {
            beforeUpdate: (agent) => {
                if (agent.changed('status')) {
                    console.log(`[INFO] Agent ID: ${agent.id}, Name: ${agent.name}, Status changed to: ${agent.status}`);
                }
            },
        },
    }
);

module.exports = Agent;
