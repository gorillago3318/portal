const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    console.log(`[DEBUG] AuthMiddleware triggered for: ${req.method} ${req.originalUrl}`);

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        req.user = decoded; // Attach user data to request
        console.log('[DEBUG] User authenticated:', req.user);
        next();
    } catch (error) {
        console.error('[DEBUG] Token verification failed:', error.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        console.log('[DEBUG] Checking user role:', req.user?.role);

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            console.log('[DEBUG] Role not authorized:', req.user?.role);
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        console.log('[DEBUG] Role authorized:', req.user.role);
        next();
    };
};

module.exports = {
    authMiddleware,
    checkRole,
};
