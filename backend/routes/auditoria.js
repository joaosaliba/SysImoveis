const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken, checkAdmin } = require('../middleware/auth');
const getPagination = require('../db/pagination');

// Middleware to ensure user is authenticated and is admin
router.use(verifyToken);
router.use(checkAdmin);

/**
 * GET /api/auditoria
 * Fetch audit logs with filtering and pagination
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            usuario_id,
            acao,
            entidade,
            data_inicio,
            data_fim
        } = req.query;

        let queryParams = [];
        let whereClauses = [];

        if (usuario_id) {
            queryParams.push(usuario_id);
            whereClauses.push(`a.usuario_id = $${queryParams.length}`);
        }

        if (acao) {
            queryParams.push(acao);
            whereClauses.push(`a.acao = $${queryParams.length}`);
        }

        if (entidade) {
            queryParams.push(entidade);
            whereClauses.push(`a.entidade = $${queryParams.length}`);
        }

        if (data_inicio) {
            queryParams.push(data_inicio);
            whereClauses.push(`a.created_at >= $${queryParams.length}::timestamp`);
        }

        if (data_fim) {
            queryParams.push(`${data_fim} 23:59:59.999`);
            whereClauses.push(`a.created_at <= $${queryParams.length}::timestamp`);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Pagination
        const baseQuery = `
            FROM auditoria a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            ${whereString}
        `;

        const countResult = await pool.query(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
        const totalItems = parseInt(countResult.rows[0].total, 10);

        const pagination = getPagination(page, limit, totalItems);

        const query = `
            SELECT 
                a.*, 
                u.nome as usuario_nome,
                u.email as usuario_email
            ${baseQuery}
            ORDER BY a.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const { rows } = await pool.query(query, [...queryParams, pagination.limit, pagination.offset]);

        res.json({
            data: rows,
            pagination
        });

    } catch (error) {
        console.error('Error fetching auditoria:', error);
        res.status(500).json({ error: 'Erro ao buscar dados de auditoria' });
    }
});

/**
 * GET /api/auditoria/filtros
 * Get distinct actions and entities for the filter dropdowns
 */
router.get('/filtros', async (req, res) => {
    try {
        const usuariosQuery = pool.query(`SELECT id, nome FROM usuarios ORDER BY nome ASC`);
        const acoesQuery = pool.query(`SELECT DISTINCT acao FROM auditoria WHERE acao IS NOT NULL ORDER BY acao ASC`);
        const entidadesQuery = pool.query(`SELECT DISTINCT entidade FROM auditoria WHERE entidade IS NOT NULL ORDER BY entidade ASC`);

        const [usuariosResult, acoesResult, entidadesResult] = await Promise.all([
            usuariosQuery,
            acoesQuery,
            entidadesQuery
        ]);

        res.json({
            usuarios: usuariosResult.rows,
            acoes: acoesResult.rows.map(r => r.acao),
            entidades: entidadesResult.rows.map(r => r.entidade)
        });
    } catch (error) {
        console.error('Error fetching auditoria filters:', error);
        res.status(500).json({ error: 'Erro ao buscar filtros de auditoria' });
    }
});

module.exports = router;
