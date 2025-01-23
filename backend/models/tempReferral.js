// models/tempReferral.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust the path to your database config

const TempReferral = sequelize.define('TempReferral', {
    token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    referral_code: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    expiresAt: {
        type: DataTypes.DATE,
        defaultValue: () => {
            const now = new Date();
            now.setHours(now.getHours() + 24); // Default expiration: 24 hours
            return now;
        },
    },
}, {
    tableName: 'TempReferrals', // Table name in the database
    timestamps: false, // Disable Sequelize's automatic timestamps
});

module.exports = TempReferral;
