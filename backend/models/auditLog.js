const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    action: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    performedBy: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    details: {
        type: DataTypes.JSON,
        allowNull: true,
    },
});

module.exports = AuditLog;
