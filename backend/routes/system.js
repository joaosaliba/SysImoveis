const express = require('express');
const pool = require('../db/pool');
const { verifyToken, isSystemAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);
router.use(isSystemAdmin);

/**
 * Get all organizations (realms) with subscription info and usage stats
 */
router.get('/realms', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                r.id, 
                r.nome, 
                r.slug, 
                r.status_assinatura, 
                r.created_at,
                p.nome as plano_nome,
                p.preco as plano_preco,
                a.data_fim as assinatura_fim,
                (SELECT COUNT(*) FROM propriedades WHERE realm_id = r.id) as total_propriedades,
                (SELECT COUNT(*) FROM inquilinos WHERE realm_id = r.id) as total_inquilinos,
                (SELECT COUNT(*) FROM contratos WHERE realm_id = r.id) as total_contratos
            FROM realms r
            LEFT JOIN assinaturas a ON r.assinatura_atual_id = a.id
            LEFT JOIN planos p ON a.plano_id = p.id
            ORDER BY r.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('System Admin: Error fetching realms:', error);
        res.status(500).json({ error: 'Erro ao buscar lista de organizações.' });
    }
});

/**
 * Manually update subscription/status for a realm (Admin Override)
 */
router.post('/realms/:id/subscription', async (req, res) => {
    const { id } = req.params;
    const { status, plano_id, data_fim } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Update realm status
        if (status) {
            await client.query('UPDATE realms SET status_assinatura = $1 WHERE id = $2', [status, id]);
        }

        // 2. If plano_id or data_fim provided, create/update a manual subscription record
        if (plano_id || data_fim) {
            // Find current master user for this realm
            const userResult = await client.query('SELECT id FROM usuarios WHERE realm_id = $1 AND is_master = true LIMIT 1', [id]);
            const userId = userResult.rows[0]?.id;

            if (!userId) {
                throw new Error('No master user found for this realm');
            }

            const currentPlanResult = await client.query('SELECT preco FROM planos WHERE id = $1', [plano_id]);
            const preco = currentPlanResult.rows[0]?.preco || 0;

            const subResult = await client.query(`
                INSERT INTO assinaturas (usuario_id, plano_id, realm_id, status, data_inicio, data_fim, valor_assinatura)
                VALUES ($1, $2, $3, $4, NOW(), $5, $6)
                RETURNING id
            `, [userId, plano_id, id, status || 'active', data_fim || null, preco]);

            const subId = subResult.rows[0].id;

            await client.query('UPDATE realms SET assinatura_atual_id = $1 WHERE id = $2', [subId, id]);
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Assinatura atualizada com sucesso.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('System Admin: Error updating subscription:', error);
        res.status(500).json({ error: 'Erro ao atualizar assinatura.' });
    } finally {
        client.release();
    }
});

/**
 * Global system statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM realms) as total_realms,
                (SELECT COUNT(*) FROM usuarios) as total_users,
                (SELECT COUNT(*) FROM propriedades) as total_propriedades,
                (SELECT COUNT(*) FROM inquilinos) as total_inquilinos,
                (SELECT SUM(valor) FROM pagamentos WHERE status = 'approved') as total_revenue,
                (SELECT COUNT(*) FROM realms WHERE status_assinatura = 'active') as active_subscribers
        `);
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('System Admin: Error fetching stats:', error);
        res.status(500).json({ error: 'Erro ao buscar estatísticas globais.' });
    }
});

module.exports = router;
