// config/db.js
require('dotenv').config({ path: __dirname + '/../.env' });

const { Sequelize } = require('sequelize');

// Debug log to check if .env is loaded correctly
console.log('DATABASE_URL:', process.env.DATABASE_URL); // Add this log to see if the DATABASE_URL is being loaded

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in the environment variables.');
    process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false, // Accept self-signed certificates
        },
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
});

// Test DB connection
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully with SSL.');
    } catch (error) {
        console.error('Unable to connect to the database:', error.message);
        process.exit(1);
    }
})();

module.exports = sequelize;
