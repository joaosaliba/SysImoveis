const pool = require('../db/pool');

/**
 * Logs an action to the audit table.
 *
 * @param {Object} req - The Express request object containing user info and IP.
 * @param {string} acao - Action performed (e.g., 'CRIAR', 'ATUALIZAR', 'EXCLUIR', 'LOGIN')
 * @param {string} entidade - The entity affected (e.g., 'Imovel', 'Contrato', 'Inquilino')
 * @param {string} entidade_id - UUID of the affected entity
 * @param {Object} dados_antigos - JSON representing the old state
 * @param {Object} dados_novos - JSON representing the new state
 * @param {string} detalhes - Text details of the change
 */
async function logAudit(req, acao, entidade, entidade_id = null, dados_antigos = null, dados_novos = null, detalhes = null) {
    try {
        const usuario_id = req.user ? req.user.id : null;
        const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
        const organizacao_id = req.organizacao_id || (req.user ? req.user.organizacao_id : null);

        await pool.query(
            `INSERT INTO auditoria 
            (usuario_id, acao, entidade, entidade_id, dados_antigos, dados_novos, detalhes, ip, organizacao_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
                usuario_id,
                acao,
                entidade,
                entidade_id,
                dados_antigos,
                dados_novos,
                detalhes,
                ip,
                organizacao_id
            ]
        );
    } catch (error) {
        console.error('Audit Log Error:', error);
    }
}

module.exports = {
    logAudit
};
