const jwt = require('jsonwebtoken');

// Define admin user payload
const payload = {
    id: "38ee9414-c743-494b-9da1-368fe23fc93c", // Replace with the actual admin ID from your database
    role: "Admin"   // Admin role
};

// Ensure your environment variables are loaded
require('dotenv').config();

// Use the same secret key as in your `.env` file
const secretKey = process.env.JWT_SECRET || "your_default_secret_key"; // Replace with your actual secret key

// Generate the token
const token = jwt.sign(payload, secretKey, { expiresIn: '24h' });

console.log("Generated Admin Token:", token);
