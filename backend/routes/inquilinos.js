const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');

const router = express.Router();
router.use(verifyToken);

// List all tenants (with optional search and pagination)
router.get('/', async (req, res) => {
    try {
        const { search, page, limit } = req.query;
        const { offset, limit: limitNum, page: pageNum } = getPaginationParams(page, limit);

        let whereClause = '';
        let params = [];

        if (search) {
            whereClause = ` WHERE nome_completo ILIKE $1 OR cpf ILIKE $1`;
            params = [`%${search}%`];
        }

        // Count total
        const countQuery = `SELECT COUNT(*) FROM inquilinos${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `SELECT * FROM inquilinos ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
        const dataParams = [...params, limitNum, offset];
        const result = await pool.query(dataQuery, dataParams);

        res.json(formatPaginatedResponse(result.rows, total, pageNum, limitNum));
    } catch (err) {
        console.error('List tenants error:', err);
        res.status(500).json({ error: 'Erro ao listar inquilinos.' });
    }
});

// Get single tenant
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inquilinos WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquilino não encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get tenant error:', err);
        res.status(500).json({ error: 'Erro ao buscar inquilino.' });
    }
});

// Create tenant
router.post('/', async (req, res) => {
    try {
        const { cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones, email, observacoes, restricoes } = req.body;

        if (!cpf || !nome_completo) {
            return res.status(400).json({ error: 'CPF e nome completo são obrigatórios.' });
        }

        const existing = await pool.query('SELECT id FROM inquilinos WHERE cpf = $1', [cpf]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'CPF já cadastrado.' });
        }

        const result = await pool.query(
            `INSERT INTO inquilinos (cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones, email, observacoes, restricoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [cpf, nome_completo, rg, orgao_emissor, uf_rg, JSON.stringify(telefones || []), email, observacoes, restricoes]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create tenant error:', err);
        res.status(500).json({ error: 'Erro ao criar inquilino.' });
    }
});

// Update tenant
router.put('/:id', async (req, res) => {
    try {
        const { cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones, email, observacoes, restricoes } = req.body;

        const result = await pool.query(
            `UPDATE inquilinos SET
        cpf = COALESCE($1, cpf),
        nome_completo = COALESCE($2, nome_completo),
        rg = COALESCE($3, rg),
        orgao_emissor = COALESCE($4, orgao_emissor),
        uf_rg = COALESCE($5, uf_rg),
        telefones = COALESCE($6, telefones),
        email = COALESCE($7, email),
        observacoes = COALESCE($8, observacoes),
        restricoes = COALESCE($9, restricoes),
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
            [cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones ? JSON.stringify(telefones) : null, email, observacoes, restricoes, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquilino não encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update tenant error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'CPF já cadastrado para outro inquilino.' });
        }
        res.status(500).json({ error: 'Erro ao atualizar inquilino.' });
    }
});

// Delete tenant
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM inquilinos WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquilino não encontrado.' });
        }
        res.json({ message: 'Inquilino removido com sucesso.' });
    } catch (err) {
        console.error('Delete tenant error:', err);
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Inquilino possui contratos vinculados e não pode ser removido.' });
        }
        res.status(500).json({ error: 'Erro ao remover inquilino.' });
    }
});

module.exports = router;
