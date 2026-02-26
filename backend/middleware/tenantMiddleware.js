/**
 * Tenant Middleware — extracts organizacao_id from the authenticated user's JWT
 * and places it on req.organizacao_id for downstream usage.
 *
 * Must be used AFTER verifyToken (req.user must exist).
 */
function tenantMiddleware(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (!req.user.organizacao_id) {
        return res.status(403).json({ error: 'Usuário sem organização associada.' });
    }

    req.organizacao_id = req.user.organizacao_id;
    next();
}

module.exports = tenantMiddleware;
