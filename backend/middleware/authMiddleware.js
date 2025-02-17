const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEBUG] AuthMiddleware triggered for: ${req.method} ${req.originalUrl}`);
    }

    const authHeader = req.headers.authorization?.trim();
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        req.user = decoded;
        if (process.env.NODE_ENV !== 'production') {
            console.log('[DEBUG] User authenticated:', req.user);
        }
        next();
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[DEBUG] Token verification failed:', error.message);
        }
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

const checkRole = (allowedRoles) => {
    return (req, res, next) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('[DEBUG] Allowed roles:', allowedRoles);
            console.log('[DEBUG] User role:', req.user?.role);
        }

        if (!req.user || !allowedRoles.includes(req.user.role)) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('[DEBUG] Role not authorized:', req.user?.role);
            }
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('[DEBUG] Role authorized:', req.user.role);
        }
        next();
    };
};

module.exports = {
    authMiddleware,
    checkRole,
};
