const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');
const { verifyToken, checkAdmin } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenantMiddleware');

const router = express.Router();

// ============================================================
// PUBLIC: Signup — creates organization + first admin user
// ============================================================
router.post('/signup', async (req, res) => {
    const client = await pool.connect();
    try {
        const { org_nome, nome, email, senha } = req.body;

        if (!org_nome || !nome || !email || !senha) {
            return res.status(400).json({ error: 'Nome da organização, nome, email e senha são obrigatórios.' });
        }

        if (senha.length < 6) {
            return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' });
        }

        // Generate slug from org name
        const slug = org_nome
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        await client.query('BEGIN');

        // Check if slug already exists
        const existingOrg = await client.query('SELECT id FROM organizacoes WHERE slug = $1', [slug]);
        if (existingOrg.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Já existe uma organização com este nome.' });
        }

        // Check if email already exists
        const existingUser = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Email já cadastrado.' });
        }

        // Create organization
        const orgResult = await client.query(
            'INSERT INTO organizacoes (nome, slug) VALUES ($1, $2) RETURNING *',
            [org_nome, slug]
        );
        const org = orgResult.rows[0];

        // Create admin user for this org
        const senha_hash = await bcrypt.hash(senha, 12);
        const userResult = await client.query(
            'INSERT INTO usuarios (nome, email, senha_hash, is_admin, organizacao_id) VALUES ($1, $2, $3, TRUE, $4) RETURNING id, nome, email, is_admin, organizacao_id, created_at',
            [nome, email, senha_hash, org.id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            message: 'Organização e usuário criados com sucesso.',
            organizacao: { id: org.id, nome: org.nome, slug: org.slug },
            user: userResult.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
        client.release();
    }
});

// ============================================================
// PUBLIC: Login
// ============================================================
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
        }

        const result = await pool.query(
            `SELECT u.*, p.nome AS perfil_nome, o.nome AS organizacao_nome, o.slug AS organizacao_slug
             FROM usuarios u
             LEFT JOIN perfis p ON u.perfil_id = p.id
             LEFT JOIN organizacoes o ON u.organizacao_id = o.id
             WHERE u.email = $1`,
            [email]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(senha, user.senha_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        if (!user.organizacao_id) {
            return res.status(403).json({ error: 'Usuário sem organização associada. Contate o administrador.' });
        }

        const accessToken = jwt.sign(
            {
                id: user.id, email: user.email, nome: user.nome,
                is_admin: user.is_admin || false,
                perfil_id: user.perfil_id || null,
                organizacao_id: user.organizacao_id
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        await pool.query('UPDATE usuarios SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id, nome: user.nome, email: user.email,
                is_admin: user.is_admin || false,
                perfil_id: user.perfil_id || null,
                perfil_nome: user.perfil_nome || null,
                organizacao_id: user.organizacao_id,
                organizacao_nome: user.organizacao_nome || null,
                organizacao_slug: user.organizacao_slug || null,
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// ============================================================
// PUBLIC: Refresh Token
// ============================================================
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token é obrigatório.' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const result = await pool.query(
            `SELECT u.*, p.nome AS perfil_nome, o.nome AS organizacao_nome, o.slug AS organizacao_slug
             FROM usuarios u
             LEFT JOIN perfis p ON u.perfil_id = p.id
             LEFT JOIN organizacoes o ON u.organizacao_id = o.id
             WHERE u.id = $1 AND u.refresh_token = $2`,
            [decoded.id, refreshToken]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Refresh token inválido.' });
        }

        const user = result.rows[0];

        const newAccessToken = jwt.sign(
            {
                id: user.id, email: user.email, nome: user.nome,
                is_admin: user.is_admin || false,
                perfil_id: user.perfil_id || null,
                organizacao_id: user.organizacao_id
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
        );

        const newRefreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        await pool.query('UPDATE usuarios SET refresh_token = $1 WHERE id = $2', [newRefreshToken, user.id]);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user.id, nome: user.nome, email: user.email,
                is_admin: user.is_admin || false,
                perfil_id: user.perfil_id || null,
                perfil_nome: user.perfil_nome || null,
                organizacao_id: user.organizacao_id,
                organizacao_nome: user.organizacao_nome || null,
                organizacao_slug: user.organizacao_slug || null,
            }
        });
    } catch (err) {
        console.error('Refresh error:', err);
        res.status(403).json({ error: 'Refresh token inválido ou expirado.' });
    }
});

// ============================================================
// PROTECTED: Routes below require verifyToken + tenantMiddleware
// ============================================================
router.use(verifyToken);
router.use(tenantMiddleware);

// Register (only admin can create users WITHIN the same org)
router.post('/register', checkAdmin, async (req, res) => {
    try {
        const { nome, email, senha, is_admin, perfil_id } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
        }

        const existing = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email já cadastrado.' });
        }

        const senha_hash = await bcrypt.hash(senha, 12);

        const result = await pool.query(
            'INSERT INTO usuarios (nome, email, senha_hash, is_admin, perfil_id, organizacao_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, email, is_admin, perfil_id, organizacao_id, created_at',
            [nome, email, senha_hash, is_admin === true, perfil_id || null, req.organizacao_id]
        );

        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Get all users (Admin only) – paginated + searchable – FILTERED BY ORG
router.get('/users', checkAdmin, async (req, res) => {
    try {
        const { offset, limit, page } = getPaginationParams(req.query.page, req.query.limit);
        const search = req.query.search || '';

        const conditions = ['u.organizacao_id = $1'];
        const params = [req.organizacao_id];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(u.nome ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
        }

        const where = `WHERE ${conditions.join(' AND ')}`;

        const countResult = await pool.query(`SELECT COUNT(*) FROM usuarios u ${where}`, params);
        const total = parseInt(countResult.rows[0].count);

        const dataParams = [...params, limit, offset];
        const result = await pool.query(
            `SELECT u.id, u.nome, u.email, u.is_admin, u.perfil_id, u.created_at, u.updated_at, p.nome AS perfil_nome
             FROM usuarios u LEFT JOIN perfis p ON u.perfil_id = p.id
             ${where} ORDER BY u.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            dataParams
        );

        res.json(formatPaginatedResponse(result.rows, total, page, limit));
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
});

// Update user (Admin only) – is_admin + perfil_id – SAME ORG ONLY
router.put('/users/:id', checkAdmin, async (req, res) => {
    try {
        const { is_admin, perfil_id } = req.body;
        const userId = req.params.id;

        // Verify user belongs to same org
        const userCheck = await pool.query('SELECT id FROM usuarios WHERE id = $1 AND organizacao_id = $2', [userId, req.organizacao_id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const setClauses = ['updated_at = NOW()'];
        const params = [];

        // is_admin toggle
        params.push(is_admin === true);
        setClauses.push(`is_admin = $${params.length}`);

        // perfil_id can be null (to remove profile) or a valid UUID
        params.push(perfil_id || null);
        setClauses.push(`perfil_id = $${params.length}`);

        params.push(userId);
        const result = await pool.query(
            `UPDATE usuarios SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING id, nome, email, is_admin, perfil_id`,
            params
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
});

// Delete user (Admin only) – SAME ORG ONLY
router.delete('/users/:id', checkAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário.' });
        }

        const result = await pool.query('DELETE FROM usuarios WHERE id = $1 AND organizacao_id = $2 RETURNING id', [userId, req.organizacao_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        res.json({ message: 'Usuário removido com sucesso.' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Erro ao remover usuário.' });
    }
});

module.exports = router;
