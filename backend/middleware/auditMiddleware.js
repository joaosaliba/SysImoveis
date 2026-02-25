const { logAudit } = require('../services/auditService');

/**
 * Express middleware to automatically log mutating requests (POST, PUT, PATCH, DELETE)
 * to the auditoria table.
 */
const auditMiddleware = (req, res, next) => {
    // Only log mutating methods
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return next();
    }

    // Intercept the response finish to log after successful completion
    res.on('finish', () => {
        // Only log successful operations (2xx or 3xx)
        if (res.statusCode >= 200 && res.statusCode < 400) {
            // Determine action based on method
            let acao;
            switch (method) {
                case 'POST': acao = 'CRIAR'; break;
                case 'PUT':
                case 'PATCH': acao = 'ATUALIZAR'; break;
                case 'DELETE': acao = 'EXCLUIR'; break;
                default: acao = method;
            }

            // Parse URL to get entity and ID
            // Example URL: /api/propriedades/123-abc...
            const pathParts = req.baseUrl.split('/').filter(Boolean).concat(req.path.split('/').filter(Boolean));
            let entidade = 'Desconhecido';
            let entidade_id = null;

            // In our structure, paths are like /api/propriedades
            // so pathParts will be something like ['api', 'propriedades'] or ['propriedades', '123'] (if baseUrl is /api/propriedades)
            // Let's use req.originalUrl to be safe: /api/propriedades/123
            const originalParts = req.originalUrl.split('?')[0].split('/').filter(Boolean);

            // Expected originalParts: ['api', 'propriedades', '123']
            if (originalParts.length >= 2) {
                entidade = originalParts[1].toUpperCase(); // 'PROPRIEDADES'
                if (originalParts.length >= 3 && originalParts[2].length > 10) {
                    // Simple check if it might be an ID (uuid usually 36 chars)
                    entidade_id = originalParts[2];
                }
            }

            // For login, we can override the action based on the URL
            if (req.originalUrl.includes('/api/auth/login')) {
                acao = 'LOGIN';
                entidade = 'AUTENTICACAO';
            }

            // Capture dados_novos from the request body (do not log passwords)
            let dados_novos = null;
            if (req.body && Object.keys(req.body).length > 0) {
                const safeBody = { ...req.body };
                delete safeBody.senha;
                delete safeBody.senha_atual;
                delete safeBody.nova_senha;
                dados_novos = safeBody;
            }

            // We log the audit asynchronously so it doesn't block the request response
            logAudit(
                req,
                acao,
                entidade,
                entidade_id,
                null, // dados_antigos are hard to get in a generic middleware
                dados_novos,
                `Requisição ${method} em ${req.originalUrl}`
            );
        }
    });

    next();
};

module.exports = auditMiddleware;
