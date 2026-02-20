const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');

const router = express.Router();
router.use(verifyToken);

// List all units with pagination
router.get('/', async (req, res) => {
    try {
        const { realm_id } = req.user;
        const { offset, limit: limitNum, page: pageNum } = getPaginationParams(page, limit);

        let whereClause = 'WHERE realm_id = $1';
        let params = [realm_id];
        let paramIndex = 2;

        if (status && status !== 'todos') {
            whereClause += ` AND status = $${paramIndex++}`;
            params.push(status);
        }
        if (propriedade_id) {
            whereClause += ` AND propriedade_id = $${paramIndex++}`;
            params.push(propriedade_id);
        }

        // Count total
        const countQuery = `SELECT COUNT(*) FROM unidades ${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `SELECT * FROM unidades ${whereClause} ORDER BY identificador LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        const dataParams = [...params, limitNum, offset];
        const result = await pool.query(dataQuery, dataParams);

        res.json(formatPaginatedResponse(result.rows, total, pageNum, limitNum));
    } catch (err) {
        console.error('List all units error:', err);
        res.status(500).json({ error: 'Erro ao listar todas as unidades.' });
    }
});

module.exports = router;
