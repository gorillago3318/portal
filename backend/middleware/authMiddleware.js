const authMiddleware = (req, res, next) => {
    console.log("[DEBUG] Checking authentication");

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1]; // Extract the token after "Bearer"

    // Mock validation: check if the token matches 'your-test-token'
    if (token !== "your-test-token") {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }

    // Mock user for testing
    req.user = { id: "mock-user-id", role: "Admin" }; // Change "Admin" to test other roles
    console.log("[DEBUG] User authenticated:", req.user);
    next();
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        console.log("[DEBUG] Checking roles");

        const userRole = req.user?.role; // Role from mock user
        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
        }

        console.log("[DEBUG] Role authorized:", userRole);
        next();
    };
};

module.exports = {
    authMiddleware,
    checkRole,
};
