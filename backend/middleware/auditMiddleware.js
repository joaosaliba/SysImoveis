const { logAudit } = require('../services/auditService');

// Rotas que já possuem auditoria explícita — o middleware genérico não deve duplicar
const ROTAS_COM_AUDITORIA_EXPLICITA = [
    '/api/contratos',
    '/api/inquilinos',
    '/api/auth',
];

/**
 * Express middleware to automatically log mutating requests (POST, PUT, PATCH, DELETE)
 * for routes that do NOT have explicit audit calls already.
 */
const auditMiddleware = (req, res, next) => {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return next();
    }

    // Skip routes that already have explicit audit logging
    const url = req.originalUrl.split('?')[0];
    const skip = ROTAS_COM_AUDITORIA_EXPLICITA.some(rota => url.startsWith(rota));
    if (skip) {
        return next();
    }

    res.on('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
            let acao;
            switch (method) {
                case 'POST': acao = 'CRIAR'; break;
                case 'PUT': acao = 'ATUALIZAR'; break;
                case 'PATCH': acao = 'ATUALIZAR'; break;
                case 'DELETE': acao = 'EXCLUIR'; break;
                default: acao = method;
            }

            const originalParts = url.split('/').filter(Boolean);
            // Structure: ['api', 'propriedades', '<uuid>']
            let entidade = originalParts[1] ? originalParts[1].toUpperCase() : 'DESCONHECIDO';
            let entidade_id = null;
            if (originalParts.length >= 3 && originalParts[2].length > 10) {
                entidade_id = originalParts[2];
            }

            const ENTIDADE_MAP = {
                'PROPRIEDADES': 'IMÓVEL',
                'UNIDADES': 'UNIDADE',
                'USUARIOS': 'USUÁRIO',
                'PERFIS': 'PERFIL',
            };
            entidade = ENTIDADE_MAP[entidade] || entidade;

            let dados_novos = null;
            if (req.body && Object.keys(req.body).length > 0) {
                const safeBody = { ...req.body };
                delete safeBody.senha;
                delete safeBody.senha_atual;
                delete safeBody.nova_senha;
                dados_novos = safeBody;
            }

            logAudit(
                req, acao, entidade, entidade_id, null, dados_novos,
                `${method} em ${url}`
            );
        }
    });

    next();
};

module.exports = auditMiddleware;
