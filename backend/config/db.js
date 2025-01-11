const { Sequelize } = require('sequelize');

// Ensure DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in the environment variables.');
    process.exit(1);
}

// Initialize Sequelize using connection URI from .env
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false, // Allow SSL connection
        },
    },
    pool: {
        max: 10, // Maximum number of connections
        min: 0,  // Minimum number of connections
        acquire: 30000, // Maximum time (ms) to try getting a connection
        idle: 10000, // Time (ms) before releasing an idle connection
    },
    logging: process.env.NODE_ENV !== 'production', // Enable logging only in non-production environments
});

// Test Database Connection
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected...');
    } catch (err) {
        console.error('Error connecting to the database:', err);
        process.exit(1); // Exit the application if the database connection fails
    }
})();

module.exports = sequelize;
