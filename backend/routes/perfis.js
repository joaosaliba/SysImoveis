const express = require('express');
const pool = require('../db/pool');
const { verifyToken, checkAdmin } = require('../middleware/auth');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');

const router = express.Router();
router.use(verifyToken);
router.use(checkAdmin);

// ============================================
// MÓDULOS E AÇÕES — FONTE ÚNICA DE VERDADE
// Para adicionar um novo módulo, basta adicionar aqui.
// Os perfis existentes receberão o módulo automaticamente.
// ============================================
const MODULOS = [
    { key: 'dashboard', label: 'Dashboard', acoes: ['ver'] },
    { key: 'imoveis', label: 'Imóveis', acoes: ['ver', 'salvar', 'deletar'] },
    { key: 'inquilinos', label: 'Inquilinos', acoes: ['ver', 'salvar', 'deletar'] },
    { key: 'contratos', label: 'Contratos', acoes: ['ver', 'salvar', 'deletar'] },
    { key: 'boletos', label: 'Boletos', acoes: ['ver', 'salvar', 'deletar'] },
    { key: 'relatorios', label: 'Relatórios', acoes: ['ver'] },
    { key: 'usuarios', label: 'Usuários', acoes: ['ver', 'salvar', 'deletar'] },
];

/**
 * Sincroniza as permissões de um perfil com a lista MODULOS.
 * Módulos/ações faltantes são inseridos com permitido = false.
 * @param {object} client — pool ou client de transação
 * @param {string} perfilId
 */
async function syncPermissoes(client, perfilId) {
    // Buscar permissões existentes
    const existing = await client.query(
        'SELECT modulo, acao FROM perfil_permissoes WHERE perfil_id = $1',
        [perfilId]
    );
    const existingSet = new Set(existing.rows.map(r => `${r.modulo}:${r.acao}`));

    // Inserir faltantes
    for (const m of MODULOS) {
        for (const a of m.acoes) {
            const key = `${m.key}:${a}`;
            if (!existingSet.has(key)) {
                await client.query(
                    'INSERT INTO perfil_permissoes (perfil_id, modulo, acao, permitido) VALUES ($1, $2, $3, false) ON CONFLICT (perfil_id, modulo, acao) DO NOTHING',
                    [perfilId, m.key, a]
                );
            }
        }
    }
}

// GET /api/perfis/modulos - retorna a lista de módulos disponíveis
router.get('/modulos', (req, res) => {
    res.json(MODULOS);
});

// POST /api/perfis/sync-all - sincroniza TODOS os perfis com a lista de módulos atual
router.post('/sync-all', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const perfis = await client.query('SELECT id FROM perfis');
        for (const p of perfis.rows) {
            await syncPermissoes(client, p.id);
        }
        await client.query('COMMIT');
        res.json({ message: `Sincronizados ${perfis.rows.length} perfis com ${MODULOS.length} módulos.` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Sync all error:', err);
        res.status(500).json({ error: 'Erro ao sincronizar perfis.' });
    } finally {
        client.release();
    }
});

// GET /api/perfis - listar perfis com contagem de usuários
router.get('/', async (req, res) => {
    try {
        const { page, limit, search } = req.query;
        const { offset, limit: limitNum, page: pageNum } = getPaginationParams(page, limit);

        const conditions = [];
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(p.nome ILIKE $${params.length} OR p.descricao ILIKE $${params.length})`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await pool.query(`SELECT COUNT(*) FROM perfis p ${where}`, params);
        const total = parseInt(countResult.rows[0].count);

        const dataParams = [...params, limitNum, offset];
        const result = await pool.query(
            `SELECT p.*, 
                (SELECT COUNT(*) FROM usuarios u WHERE u.perfil_id = p.id) AS total_usuarios
             FROM perfis p ${where}
             ORDER BY p.created_at DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            dataParams
        );

        res.json(formatPaginatedResponse(result.rows, total, pageNum, limitNum));
    } catch (err) {
        console.error('List perfis error:', err);
        res.status(500).json({ error: 'Erro ao listar perfis.' });
    }
});

// GET /api/perfis/:id - detalhe do perfil com permissões (auto-sync)
router.get('/:id', async (req, res) => {
    try {
        const perfilResult = await pool.query('SELECT * FROM perfis WHERE id = $1', [req.params.id]);
        if (perfilResult.rows.length === 0) {
            return res.status(404).json({ error: 'Perfil não encontrado.' });
        }

        // Auto-sync: garante que módulos novos apareçam
        await syncPermissoes(pool, req.params.id);

        const permissoes = await pool.query(
            'SELECT modulo, acao, permitido FROM perfil_permissoes WHERE perfil_id = $1 ORDER BY modulo, acao',
            [req.params.id]
        );

        res.json({
            ...perfilResult.rows[0],
            permissoes: permissoes.rows
        });
    } catch (err) {
        console.error('Get perfil error:', err);
        res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
});

// POST /api/perfis - criar perfil com permissões (auto-sync)
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { nome, descricao, permissoes } = req.body;

        if (!nome) {
            return res.status(400).json({ error: 'Nome do perfil é obrigatório.' });
        }

        const perfilResult = await client.query(
            'INSERT INTO perfis (nome, descricao) VALUES ($1, $2) RETURNING *',
            [nome, descricao || null]
        );
        const perfil = perfilResult.rows[0];

        // Auto-sync: cria todas as entradas com false primeiro
        await syncPermissoes(client, perfil.id);

        // Aplicar permissões do payload (override)
        if (Array.isArray(permissoes)) {
            for (const p of permissoes) {
                await client.query(
                    'INSERT INTO perfil_permissoes (perfil_id, modulo, acao, permitido) VALUES ($1, $2, $3, $4) ON CONFLICT (perfil_id, modulo, acao) DO UPDATE SET permitido = $4',
                    [perfil.id, p.modulo, p.acao, p.permitido ?? false]
                );
            }
        }

        await client.query('COMMIT');

        const permissoesResult = await pool.query(
            'SELECT modulo, acao, permitido FROM perfil_permissoes WHERE perfil_id = $1 ORDER BY modulo, acao',
            [perfil.id]
        );

        res.status(201).json({ ...perfil, permissoes: permissoesResult.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create perfil error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Já existe um perfil com este nome.' });
        }
        res.status(500).json({ error: 'Erro ao criar perfil.' });
    } finally {
        client.release();
    }
});

// PUT /api/perfis/:id - atualizar perfil e permissões (auto-sync)
router.put('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { nome, descricao, permissoes } = req.body;
        const perfilId = req.params.id;

        const updateResult = await client.query(
            'UPDATE perfis SET nome = COALESCE($1, nome), descricao = COALESCE($2, descricao), updated_at = NOW() WHERE id = $3 RETURNING *',
            [nome, descricao, perfilId]
        );

        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Perfil não encontrado.' });
        }

        // Auto-sync: garante módulos novos
        await syncPermissoes(client, perfilId);

        // Atualizar permissões do payload (upsert)
        if (Array.isArray(permissoes)) {
            for (const p of permissoes) {
                await client.query(
                    'INSERT INTO perfil_permissoes (perfil_id, modulo, acao, permitido) VALUES ($1, $2, $3, $4) ON CONFLICT (perfil_id, modulo, acao) DO UPDATE SET permitido = $4',
                    [perfilId, p.modulo, p.acao, p.permitido ?? false]
                );
            }
        }

        await client.query('COMMIT');

        const permissoesResult = await pool.query(
            'SELECT modulo, acao, permitido FROM perfil_permissoes WHERE perfil_id = $1 ORDER BY modulo, acao',
            [perfilId]
        );

        res.json({ ...updateResult.rows[0], permissoes: permissoesResult.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update perfil error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Já existe um perfil com este nome.' });
        }
        res.status(500).json({ error: 'Erro ao atualizar perfil.' });
    } finally {
        client.release();
    }
});

// DELETE /api/perfis/:id - remover perfil
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM perfis WHERE id = $1 RETURNING id, nome', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Perfil não encontrado.' });
        }
        res.json({ message: 'Perfil removido com sucesso.' });
    } catch (err) {
        console.error('Delete perfil error:', err);
        res.status(500).json({ error: 'Erro ao remover perfil.' });
    }
});

module.exports = router;
