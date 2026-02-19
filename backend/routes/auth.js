const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { verifyToken, checkRole, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Register (only admin can create users with specific roles)
router.post('/register', async (req, res) => {
    try {
        const { nome, email, senha, role } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
        }

        const existing = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email já cadastrado.' });
        }

        const senha_hash = await bcrypt.hash(senha, 12);
        
        // Default role is 'gestor', only admin can set other roles
        const userRole = role === 'admin' || role === 'inquilino' ? role : 'gestor';
        
        const result = await pool.query(
            'INSERT INTO usuarios (nome, email, senha_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, role, created_at',
            [nome, email, senha_hash, userRole]
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

        const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(senha, user.senha_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, nome: user.nome, role: user.role || 'gestor' },
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
            user: { id: user.id, nome: user.nome, email: user.email, role: user.role || 'gestor' }
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
        const result = await pool.query('SELECT * FROM usuarios WHERE id = $1 AND refresh_token = $2', [decoded.id, refreshToken]);

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Refresh token inválido.' });
        }

        const user = result.rows[0];

        const newAccessToken = jwt.sign(
            { id: user.id, email: user.email, nome: user.nome, role: user.role || 'gestor' },
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
            user: { id: user.id, nome: user.nome, email: user.email, role: user.role || 'gestor' }
        });
    } catch (err) {
        console.error('Refresh error:', err);
        res.status(403).json({ error: 'Refresh token inválido ou expirado.' });
    }
});

// Get all users (Admin only)
router.get('/users', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nome, email, role, created_at, updated_at FROM usuarios ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
});

// Update user role (Admin only)
router.put('/users/:id/role', verifyToken, checkRole(['admin']), async (req, res) => {
    try {
        const { role } = req.body;
        const userId = req.params.id;

        if (!role || !['admin', 'gestor', 'inquilino'].includes(role)) {
            return res.status(400).json({ error: 'Role inválido.' });
        }

        const result = await pool.query(
            'UPDATE usuarios SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nome, email, role',
            [role, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update role error:', err);
        res.status(500).json({ error: 'Erro ao atualizar role do usuário.' });
    }
});

// Delete user (Admin only)
router.delete('/users/:id', verifyToken, checkRole(['admin']), async (req, res) => {
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
