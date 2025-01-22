// config/db.js
require('dotenv').config(); // Add this line to load environment variables

const { Sequelize } = require('sequelize');

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
