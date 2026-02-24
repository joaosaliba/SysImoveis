const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

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
 * Middleware para verificar se o usuário é admin (is_admin = true)
 * Substitui o antigo checkRole(['admin'])
 */
function checkAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }
    if (req.user.is_admin !== true) {
        return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
}

/**
 * Helper síncrono para verificar se o usuário no req é admin
 */
function isAdmin(req) {
    return req.user && req.user.is_admin === true;
}

/**
 * Middleware para verificar permissão granular (modulo + ação)
 * Admin (is_admin) faz bypass automaticamente
 */
function checkPermission(modulo, acao) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        // Admin bypass
        if (req.user.is_admin === true) {
            return next();
        }

        try {
            const userResult = await pool.query('SELECT perfil_id FROM usuarios WHERE id = $1', [req.user.id]);
            if (userResult.rows.length === 0) {
                return res.status(401).json({ error: 'Usuário não encontrado.' });
            }

            const perfilId = userResult.rows[0].perfil_id;
            if (!perfilId) {
                return res.status(403).json({ error: `Acesso negado. Nenhum perfil atribuído.` });
            }

            const permResult = await pool.query(
                'SELECT permitido FROM perfil_permissoes WHERE perfil_id = $1 AND modulo = $2 AND acao = $3',
                [perfilId, modulo, acao]
            );

            if (permResult.rows.length === 0 || !permResult.rows[0].permitido) {
                return res.status(403).json({ error: `Acesso negado. Sem permissão para ${acao} em ${modulo}.` });
            }

            next();
        } catch (err) {
            console.error('Check permission error:', err);
            res.status(500).json({ error: 'Erro ao verificar permissão.' });
        }
    };
}

module.exports = { verifyToken, checkAdmin, isAdmin, checkPermission };
