const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { checkSubscriptionLimit } = require('../middleware/subscription');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');

const router = express.Router();
router.use(verifyToken);

// List all properties (with optional search and pagination)
router.get('/', async (req, res) => {
    try {
        const { search, page, limit } = req.query;
        const { realm_id } = req.user;
        const { offset, limit: limitNum, page: pageNum } = getPaginationParams(page, limit);

        // Build WHERE clause
        let whereClause = ' WHERE p.realm_id = $1';
        let params = [realm_id];
        let paramIndex = 2;

        if (search) {
            whereClause += ` AND (p.endereco ILIKE $${paramIndex} OR p.cidade ILIKE $${paramIndex} OR p.administrador ILIKE $${paramIndex} OR p.nome ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Count total records
        const countQuery = `SELECT COUNT(*) FROM propriedades p${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `
      SELECT p.*,
        (SELECT COUNT(*) FROM unidades u WHERE u.propriedade_id = p.id AND u.realm_id = $1) as total_unidades,
        (SELECT COUNT(*) FROM unidades u WHERE u.propriedade_id = p.id AND u.status = 'alugado' AND u.realm_id = $1) as unidades_alugadas
      FROM propriedades p
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        const dataParams = [...params, limitNum, offset];
        const result = await pool.query(dataQuery, dataParams);

        res.json(formatPaginatedResponse(result.rows, total, pageNum, limitNum));
    } catch (err) {
        console.error('List properties error:', err);
        res.status(500).json({ error: 'Erro ao listar propriedades.' });
    }
});

// Get single property with its units
router.get('/:id', async (req, res) => {
    try {
        const { realm_id } = req.user;
        const propResult = await pool.query('SELECT * FROM propriedades WHERE id = $1 AND realm_id = $2', [req.params.id, realm_id]);
        if (propResult.rows.length === 0) {
            return res.status(404).json({ error: 'Propriedade não encontrada.' });
        }

        const unidadesResult = await pool.query(
            'SELECT * FROM unidades WHERE propriedade_id = $1 AND realm_id = $2 ORDER BY identificador',
            [req.params.id, realm_id]
        );

        res.json({ ...propResult.rows[0], unidades: unidadesResult.rows });
    } catch (err) {
        console.error('Get property error:', err);
        res.status(500).json({ error: 'Erro ao buscar propriedade.' });
    }
});

// Create property
router.post('/', checkSubscriptionLimit('propriedades'), async (req, res) => {
    try {
        const { nome, endereco, numero, complemento, bairro, cidade, uf, cep, administrador, observacoes } = req.body;

        if (!endereco || !cidade || !uf) {
            return res.status(400).json({ error: 'Endereço, cidade e UF são obrigatórios.' });
        }

        const { realm_id } = req.user;
        const result = await pool.query(
            `INSERT INTO propriedades (realm_id, nome, endereco, numero, complemento, bairro, cidade, uf, cep, administrador, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
            [realm_id, nome, endereco, numero, complemento, bairro, cidade, uf, cep, administrador, observacoes]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create property error:', err);
        res.status(500).json({ error: 'Erro ao criar propriedade.' });
    }
});

// Update property
router.put('/:id', async (req, res) => {
    try {
        const { nome, endereco, numero, complemento, bairro, cidade, uf, cep, administrador, observacoes } = req.body;

        const { realm_id } = req.user;
        const result = await pool.query(
            `UPDATE propriedades SET
        nome = COALESCE($1, nome),
        endereco = COALESCE($2, endereco),
        numero = COALESCE($3, numero),
        complemento = COALESCE($4, complemento),
        bairro = COALESCE($5, bairro),
        cidade = COALESCE($6, cidade),
        uf = COALESCE($7, uf),
        cep = COALESCE($8, cep),
        administrador = COALESCE($9, administrador),
        observacoes = COALESCE($10, observacoes),
        updated_at = NOW()
       WHERE id = $11 AND realm_id = $12 RETURNING *`,
            [nome, endereco, numero, complemento, bairro, cidade, uf, cep, administrador, observacoes, req.params.id, realm_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Propriedade não encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update property error:', err);
        res.status(500).json({ error: 'Erro ao atualizar propriedade.' });
    }
});

// Delete property
router.delete('/:id', async (req, res) => {
    try {
        const { realm_id } = req.user;
        const result = await pool.query('DELETE FROM propriedades WHERE id = $1 AND realm_id = $2 RETURNING id', [req.params.id, realm_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Propriedade não encontrada.' });
        }
        res.json({ message: 'Propriedade removida com sucesso.' });
    } catch (err) {
        console.error('Delete property error:', err);
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Propriedade possui unidades com contratos vinculados e não pode ser removida.' });
        }
        res.status(500).json({ error: 'Erro ao remover propriedade.' });
    }
});

// ===== UNIDADES SUB-ROUTES =====

// List units for a property
router.get('/:id/unidades', async (req, res) => {
    try {
        const { realm_id } = req.user;
        const result = await pool.query(
            'SELECT * FROM unidades WHERE propriedade_id = $1 AND realm_id = $2 ORDER BY identificador',
            [req.params.id, realm_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('List units error:', err);
        res.status(500).json({ error: 'Erro ao listar unidades.' });
    }
});

// List ALL units (global)
router.get('/unidades/all', async (req, res) => {
    try {
        const { realm_id } = req.user;
        const result = await pool.query('SELECT * FROM unidades WHERE realm_id = $1 ORDER BY identificador', [realm_id]);
        res.json(result.rows);
    } catch (err) {
        console.error('List all units error:', err);
        res.status(500).json({ error: 'Erro ao listar todas as unidades.' });
    }
});

// Create unit
router.post('/:id/unidades', async (req, res) => {
    try {
        const { identificador, tipo_unidade, area_m2, valor_sugerido, observacoes } = req.body;

        if (!identificador || !tipo_unidade) {
            return res.status(400).json({ error: 'Identificador e tipo são obrigatórios.' });
        }

        const { realm_id } = req.user;
        const result = await pool.query(
            `INSERT INTO unidades (realm_id, propriedade_id, identificador, tipo_unidade, area_m2, valor_sugerido, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
            [realm_id, req.params.id, identificador, tipo_unidade, area_m2 || null, valor_sugerido || null, observacoes]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create unit error:', err);
        res.status(500).json({ error: 'Erro ao criar unidade.' });
    }
});

// Update unit
router.put('/unidades/:unidadeId', async (req, res) => {
    try {
        const { identificador, tipo_unidade, area_m2, valor_sugerido, observacoes, status } = req.body;

        const { realm_id } = req.user;
        const result = await pool.query(
            `UPDATE unidades SET
        identificador = COALESCE($1, identificador),
        tipo_unidade = COALESCE($2, tipo_unidade),
        area_m2 = COALESCE($3, area_m2),
        valor_sugerido = COALESCE($4, valor_sugerido),
        observacoes = COALESCE($5, observacoes),
        status = COALESCE($6, status),
        updated_at = NOW()
       WHERE id = $7 AND realm_id = $8 RETURNING *`,
            [identificador, tipo_unidade, area_m2, valor_sugerido, observacoes, status, req.params.unidadeId, realm_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Unidade não encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update unit error:', err);
        res.status(500).json({ error: 'Erro ao atualizar unidade.' });
    }
});

// Delete unit
router.delete('/unidades/:unidadeId', async (req, res) => {
    try {
        const { realm_id } = req.user;
        const result = await pool.query('DELETE FROM unidades WHERE id = $1 AND realm_id = $2 RETURNING id', [req.params.unidadeId, realm_id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Unidade não encontrada.' });
        }
        res.json({ message: 'Unidade removida com sucesso.' });
    } catch (err) {
        console.error('Delete unit error:', err);
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Unidade possui contratos vinculados e não pode ser removida.' });
        }
        res.status(500).json({ error: 'Erro ao remover unidade.' });
    }
});

module.exports = router;
