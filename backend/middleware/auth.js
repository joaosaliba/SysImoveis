const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // Fallback to query parameter for specific cases like direct browser redirects (printing)
    if (!token && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Token de acesso não fornecido.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado.', code: 'TOKEN_EXPIRED' });
        }
        return res.status(403).json({ error: 'Token inválido.' });
    }
}

/**
 * Middleware para verificar se o usuário tem pelo menos um dos roles especificados
 * @param {string[]} allowedRoles - Array de roles permitidos (ex: ['admin', 'gestor'])
 * @returns {Function} Middleware function
 */
function checkRole(allowedRoles) {
    if (!Array.isArray(allowedRoles)) {
        allowedRoles = [allowedRoles];
    }

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Acesso negado. Permissões insuficientes.',
                required: allowedRoles,
                current: req.user.role
            });
        }

        next();
    };
}

/**
 * Middleware para verificar se o usuário é admin
 */
function isAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }

    next();
}

module.exports = { verifyToken, checkRole, isAdmin };
