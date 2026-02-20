const pool = require('../db/pool');

/**
 * Middleware to check if the realm has reached its subscription limits
 * @param {string} resource - 'propriedades', 'inquilinos', or 'contratos'
 */
function checkSubscriptionLimit(resource) {
    return async (req, res, next) => {
        try {
            const { realm_id } = req.user;

            // Get limits from current plan
            const planResult = await pool.query(`
                SELECT p.limite_propriedades, p.limite_inquilinos, p.limite_contratos, r.status_assinatura
                FROM realms r
                LEFT JOIN assinaturas a ON r.assinatura_atual_id = a.id
                LEFT JOIN planos p ON a.plano_id = p.id
                WHERE r.id = $1
            `, [realm_id]);

            if (planResult.rows.length === 0) {
                return res.status(404).json({ error: 'Organização não encontrada.' });
            }

            const plan = planResult.rows[0];

            // If subscription is not active or trial, block access (already handled by verifyToken mostly, but double check)
            if (!['active', 'trial'].includes(plan.status_assinatura)) {
                return res.status(403).json({
                    error: 'Sua assinatura não está ativa. Atualize seu plano para continuar.'
                });
            }

            let limit = null;
            let currentCount = 0;
            let resourceName = '';

            if (resource === 'propriedades') {
                limit = plan.limite_propriedades;
                const countResult = await pool.query('SELECT COUNT(*) FROM propriedades WHERE realm_id = $1', [realm_id]);
                currentCount = parseInt(countResult.rows[0].count);
                resourceName = 'propriedades';
            } else if (resource === 'inquilinos') {
                limit = plan.limite_inquilinos;
                const countResult = await pool.query('SELECT COUNT(*) FROM inquilinos WHERE realm_id = $1', [realm_id]);
                currentCount = parseInt(countResult.rows[0].count);
                resourceName = 'inquilinos';
            } else if (resource === 'contratos') {
                limit = plan.limite_contratos;
                const countResult = await pool.query('SELECT COUNT(*) FROM contratos WHERE realm_id = $1', [realm_id]);
                currentCount = parseInt(countResult.rows[0].count);
                resourceName = 'contratos';
            }

            // NULL limit means unlimited
            if (limit !== null && currentCount >= limit) {
                return res.status(403).json({
                    error: `Limite de ${resourceName} atingido para o seu plano atual (${limit}). Faça um upgrade para adicionar mais.`,
                    limit: limit,
                    current: currentCount
                });
            }

            next();
        } catch (err) {
            console.error(`Subscription limit check error (${resource}):`, err);
            res.status(500).json({ error: 'Erro ao verificar limites da assinatura.' });
        }
    };
}

module.exports = { checkSubscriptionLimit };
