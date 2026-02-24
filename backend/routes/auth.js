const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');
const { verifyToken, checkAdmin } = require('../middleware/auth');

const router = express.Router();

// Register (only admin can create users)
router.post('/register', verifyToken, checkAdmin, async (req, res) => {
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
            'INSERT INTO usuarios (nome, email, senha_hash, is_admin, perfil_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, nome, email, is_admin, perfil_id, created_at',
            [nome, email, senha_hash, is_admin === true, perfil_id || null]
        );

        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
        }

        const result = await pool.query(
            `SELECT u.*, p.nome AS perfil_nome FROM usuarios u LEFT JOIN perfis p ON u.perfil_id = p.id WHERE u.email = $1`,
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

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, nome: user.nome, is_admin: user.is_admin || false, perfil_id: user.perfil_id || null },
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
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token é obrigatório.' });
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const result = await pool.query(
            `SELECT u.*, p.nome AS perfil_nome FROM usuarios u LEFT JOIN perfis p ON u.perfil_id = p.id WHERE u.id = $1 AND u.refresh_token = $2`,
            [decoded.id, refreshToken]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Refresh token inválido.' });
        }

        const user = result.rows[0];

        const newAccessToken = jwt.sign(
            { id: user.id, email: user.email, nome: user.nome, is_admin: user.is_admin || false, perfil_id: user.perfil_id || null },
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
            }
        });
    } catch (err) {
        console.error('Refresh error:', err);
        res.status(403).json({ error: 'Refresh token inválido ou expirado.' });
    }
});

// Get all users (Admin only) – paginated + searchable
router.get('/users', verifyToken, checkAdmin, async (req, res) => {
    try {
        const { offset, limit, page } = getPaginationParams(req.query.page, req.query.limit);
        const search = req.query.search || '';

        const conditions = [];
        const params = [];

        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(u.nome ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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

// Update user (Admin only) – is_admin + perfil_id
router.put('/users/:id', verifyToken, checkAdmin, async (req, res) => {
    try {
        const { is_admin, perfil_id } = req.body;
        const userId = req.params.id;

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

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Erro ao atualizar usuário.' });
    }
});

// Delete user (Admin only)
router.delete('/users/:id', verifyToken, checkAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário.' });
        }

        const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [userId]);

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
