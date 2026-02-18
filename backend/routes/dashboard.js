const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

router.get('/', async (req, res) => {
    try {
        const totalPropriedades = await pool.query('SELECT COUNT(*) FROM propriedades');
        const totalUnidades = await pool.query('SELECT COUNT(*) FROM unidades');
        const totalInquilinos = await pool.query('SELECT COUNT(*) FROM inquilinos');
        const contratosAtivos = await pool.query('SELECT COUNT(*) FROM contratos WHERE status_encerrado = false');
        const parcelasAtrasadas = await pool.query(
            `SELECT COUNT(*) FROM contrato_parcelas 
       WHERE status_pagamento = 'pendente' AND data_vencimento < CURRENT_DATE`
        );
        const receitaMensal = await pool.query(
            `SELECT COALESCE(SUM(valor_pago), 0) as total FROM contrato_parcelas 
       WHERE status_pagamento = 'pago' 
       AND date_trunc('month', data_pagamento) = date_trunc('month', CURRENT_DATE)`
        );

        res.json({
            total_propriedades: parseInt(totalPropriedades.rows[0].count),
            total_unidades: parseInt(totalUnidades.rows[0].count),
            total_inquilinos: parseInt(totalInquilinos.rows[0].count),
            contratos_ativos: parseInt(contratosAtivos.rows[0].count),
            parcelas_atrasadas: parseInt(parcelasAtrasadas.rows[0].count),
            receita_mensal: parseFloat(receitaMensal.rows[0].total)
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Erro ao carregar dashboard.' });
    }
});

module.exports = router;
