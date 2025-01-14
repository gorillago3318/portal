const { Sequelize } = require('sequelize');

// Ensure DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in the environment variables.');
    process.exit(1);
}

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
        ssl: {
            require: true, // Enforce SSL for all connections
            rejectUnauthorized: false, // Allow self-signed certificates
        },
    },
    pool: {
        max: 5, // Maximum number of connections
        min: 0, // Minimum number of connections
        acquire: 30000, // Maximum time (ms) to get a connection
        idle: 10000, // Time (ms) a connection can remain idle before being released
    },
    logging: console.log, // Optional: Enable logging for debugging
});

// Test Database Connection
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected successfully with SSL.');
    } catch (error) {
        console.error('Unable to connect to the database:', error.message);
        process.exit(1); // Exit the application if the connection fails
    }
})();

module.exports = sequelize;
