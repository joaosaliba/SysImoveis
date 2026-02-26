const express = require('express');
const pool = require('../db/pool');
const { checkPermission } = require('../middleware/auth');

const router = express.Router();
// verifyToken + tenantMiddleware applied at server.js level

// Main dashboard - KPIs
router.get('/', checkPermission('dashboard', 'ver'), async (req, res) => {
  try {
    const orgId = req.organizacao_id;
    const totalPropriedades = await pool.query('SELECT COUNT(*) FROM propriedades WHERE organizacao_id = $1', [orgId]);
    const totalUnidades = await pool.query(
      `SELECT COUNT(*) FROM unidades u JOIN propriedades p ON u.propriedade_id = p.id WHERE p.organizacao_id = $1`, [orgId]
    );
    const totalInquilinos = await pool.query('SELECT COUNT(*) FROM inquilinos WHERE organizacao_id = $1', [orgId]);
    const contratosAtivos = await pool.query('SELECT COUNT(*) FROM contratos WHERE status_encerrado = false AND organizacao_id = $1', [orgId]);
    const parcelasAtrasadas = await pool.query(
      `SELECT COUNT(*) FROM contrato_parcelas
       WHERE status_pagamento = 'pendente' AND data_vencimento < CURRENT_DATE AND organizacao_id = $1`, [orgId]
    );
    const receitaMensal = await pool.query(
      `SELECT COALESCE(SUM(
        COALESCE(valor_pago, valor_base + COALESCE(valor_iptu,0) + COALESCE(valor_agua,0) + COALESCE(valor_luz,0) + COALESCE(valor_outros,0) - COALESCE(desconto_pontualidade,0))
      ), 0) as total FROM contrato_parcelas
       WHERE status_pagamento = 'pago'
       AND date_trunc('month', COALESCE(data_pagamento, data_vencimento)) = date_trunc('month', CURRENT_DATE)
       AND organizacao_id = $1`, [orgId]
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

// Occupancy rate (ocupação vs. vacância)
router.get('/ocupacao', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE u.status = 'alugado') as alugadas,
        COUNT(*) FILTER (WHERE u.status = 'disponivel') as disponiveis,
        COUNT(*) FILTER (WHERE u.status = 'manutencao') as manutencao,
        COUNT(*) as total
      FROM unidades u
      JOIN propriedades p ON u.propriedade_id = p.id
      WHERE p.organizacao_id = $1
    `, [req.organizacao_id]);
    const row = result.rows[0];
    res.json({
      total: parseInt(row.total),
      alugadas: parseInt(row.alugadas),
      disponiveis: parseInt(row.disponiveis),
      manutencao: parseInt(row.manutencao),
      taxa_ocupacao: row.total > 0 ? (parseInt(row.alugadas) / parseInt(row.total) * 100).toFixed(1) : 0
    });
  } catch (err) {
    console.error('Ocupacao error:', err);
    res.status(500).json({ error: 'Erro ao carregar dados de ocupação.' });
  }
});

// Monthly revenue (last 12 months)
router.get('/receita-mensal', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        to_char(date_trunc('month', COALESCE(data_pagamento, data_vencimento)), 'MM/YYYY') as mes,
        COALESCE(SUM(
          COALESCE(valor_pago, valor_base + COALESCE(valor_iptu,0) + COALESCE(valor_agua,0) + COALESCE(valor_luz,0) + COALESCE(valor_outros,0) - COALESCE(desconto_pontualidade,0))
        ), 0) as total
      FROM contrato_parcelas
      WHERE status_pagamento = 'pago'
        AND COALESCE(data_pagamento, data_vencimento) >= (CURRENT_DATE - INTERVAL '12 months')
        AND organizacao_id = $1
      GROUP BY date_trunc('month', COALESCE(data_pagamento, data_vencimento))
      ORDER BY date_trunc('month', COALESCE(data_pagamento, data_vencimento))
    `, [req.organizacao_id]);

    // Fill in missing months with 0
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
      months.push({ mes: key, total: 0 });
    }

    // Merge with actual data
    const dataMap = new Map(result.rows.map(r => [r.mes, parseFloat(r.total)]));
    const filled = months.map(m => ({
      mes: m.mes,
      total: dataMap.get(m.mes) || 0
    }));

    res.json(filled);
  } catch (err) {
    console.error('Receita mensal error:', err);
    res.status(500).json({ error: 'Erro ao carregar receita mensal.' });
  }
});

// Contracts by status
router.get('/contratos-status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        CASE 
          WHEN status_encerrado = true THEN 'Encerrado'
          WHEN data_fim < CURRENT_DATE THEN 'Vencido'
          WHEN data_fim <= (CURRENT_DATE + INTERVAL '30 days') THEN 'Vence em breve'
          ELSE 'Ativo'
        END as status,
        COUNT(*) as total
      FROM contratos
      WHERE organizacao_id = $1
      GROUP BY 
        CASE 
          WHEN status_encerrado = true THEN 'Encerrado'
          WHEN data_fim < CURRENT_DATE THEN 'Vencido'
          WHEN data_fim <= (CURRENT_DATE + INTERVAL '30 days') THEN 'Vence em breve'
          ELSE 'Ativo'
        END
      ORDER BY total DESC
    `, [req.organizacao_id]);

    // Ensure all statuses are present
    const statuses = ['Ativo', 'Vence em breve', 'Vencido', 'Encerrado'];
    const dataMap = new Map(result.rows.map(r => [r.status, parseInt(r.total)]));
    const filled = statuses.map(s => ({
      status: s,
      total: dataMap.get(s) || 0
    }));

    res.json(filled);
  } catch (err) {
    console.error('Contratos status error:', err);
    res.status(500).json({ error: 'Erro ao carregar status dos contratos.' });
  }
});

// Revenue by property (top 10)
router.get('/receita-por-imovel', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(p.nome, '') || ' - ' || p.endereco as imovel,
        COALESCE(SUM(
          COALESCE(cp.valor_pago, cp.valor_base + COALESCE(cp.valor_iptu,0) + COALESCE(cp.valor_agua,0) + COALESCE(cp.valor_luz,0) + COALESCE(cp.valor_outros,0) - COALESCE(cp.desconto_pontualidade,0))
        ), 0) as total
      FROM contrato_parcelas cp
      JOIN contratos c ON cp.contrato_id = c.id
      JOIN unidades u ON c.unidade_id = u.id
      JOIN propriedades p ON u.propriedade_id = p.id
      WHERE cp.status_pagamento = 'pago'
        AND date_trunc('month', COALESCE(cp.data_pagamento, cp.data_vencimento)) >= date_trunc('month', CURRENT_DATE)
        AND cp.organizacao_id = $1
      GROUP BY p.id, p.nome, p.endereco
      ORDER BY total DESC
      LIMIT 10
    `, [req.organizacao_id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Receita por imovel error:', err);
    res.status(500).json({ error: 'Erro ao carregar receita por imóvel.' });
  }
});

module.exports = router;
