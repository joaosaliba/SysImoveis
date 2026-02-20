const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

async function verifyToken(req, res, next) {
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

        // Check subscription status for non-auth routes
        const isAuthRoute = req.path.startsWith('/auth');
        if (!isAuthRoute && !decoded.is_system_admin) {
            const realmResult = await pool.query(
                'SELECT status_assinatura FROM realms WHERE id = $1',
                [decoded.realm_id]
            );

            if (realmResult.rows.length > 0) {
                const status = realmResult.rows[0].status_assinatura;

                // Block access for cancelled, expired, or past due subscriptions (except for specific routes)
                const isBlockedRoute = !req.path.includes('/assinaturas/') &&
                    !req.path.includes('/health');

                if (isBlockedRoute && ['cancelled', 'expired', 'past_due'].includes(status)) {
                    return res.status(403).json({
                        error: 'Assinatura expirada ou cancelada. Atualize sua assinatura para continuar acessando o sistema.'
                    });
                }
            }
        }

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
 * Middleware para verificar se o usuário é master do realm
 */
function isMaster(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!req.user.is_master) {
        return res.status(403).json({ error: 'Acesso negado. Apenas usuários master podem realizar esta ação.' });
    }

    next();
}
/**
 * Middleware para verificar se o usuário é administrador do sistema (global)
 */
function isSystemAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!req.user.is_system_admin) {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores do sistema podem acessar esta área.' });
    }

    next();
}

const isAdmin = checkRole(['admin']);

module.exports = { verifyToken, checkRole, isAdmin, isMaster, isSystemAdmin };
