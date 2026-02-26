const express = require('express');
const pool = require('../db/pool');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');

const router = express.Router();
// verifyToken + tenantMiddleware applied at server.js level

// List all units with pagination
router.get('/', async (req, res) => {
    try {
        const { page, limit, status, propriedade_id } = req.query;
        const { offset, limit: limitNum, page: pageNum } = getPaginationParams(page, limit);

        let whereClause = 'WHERE p.organizacao_id = $1';
        let params = [req.organizacao_id];
        let paramIndex = 2;

        if (status && status !== 'todos') {
            whereClause += ` AND u.status = $${paramIndex++}`;
            params.push(status);
        }
        if (propriedade_id) {
            whereClause += ` AND u.propriedade_id = $${paramIndex++}`;
            params.push(propriedade_id);
        }

        // Count total
        const countQuery = `SELECT COUNT(*) FROM unidades u JOIN propriedades p ON u.propriedade_id = p.id ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `SELECT u.* FROM unidades u JOIN propriedades p ON u.propriedade_id = p.id ${whereClause} ORDER BY u.identificador LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        const dataParams = [...params, limitNum, offset];
        const result = await pool.query(dataQuery, dataParams);

        res.json(formatPaginatedResponse(result.rows, total, pageNum, limitNum));
    } catch (err) {
        console.error('List all units error:', err);
        res.status(500).json({ error: 'Erro ao listar todas as unidades.' });
    }
});

module.exports = router;
