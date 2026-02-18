const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// List all units
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM unidades ORDER BY identificador');
        res.json(result.rows);
    } catch (err) {
        console.error('List all units error:', err);
        res.status(500).json({ error: 'Erro ao listar todas as unidades.' });
    }
});

module.exports = router;
