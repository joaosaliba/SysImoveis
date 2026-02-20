const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { verifyToken, checkRole, isAdmin, isMaster } = require('../middleware/auth');

const router = express.Router();

// Register (Creates a new Realm and a Master User)
router.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { nome, email, senha, realm_nome } = req.body;

        if (!nome || !email || !senha || !realm_nome) {
            return res.status(400).json({ error: 'Nome, email, senha e nome da empresa são obrigatórios.' });
        }

        const existing = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email já cadastrado.' });
        }

        await client.query('BEGIN');

        // 1. Create Realm
        const slug = realm_nome.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const realmResult = await client.query(
            'INSERT INTO realms (nome, slug) VALUES ($1, $2) RETURNING id',
            [realm_nome, `${slug}-${Date.now()}`]
        );
        const realmId = realmResult.rows[0].id;

        // 2. Create Master User
        const senha_hash = await bcrypt.hash(senha, 12);
        const userResult = await client.query(
            'INSERT INTO usuarios (nome, email, senha_hash, role, realm_id, is_master) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, email, role, is_master, realm_id, created_at',
            [nome, email, senha_hash, 'admin', realmId, true]
        );
        const userId = userResult.rows[0].id;

        // 3. Create Default Trial Subscription
        const defaultPlanResult = await client.query('SELECT id FROM planos WHERE preco = 0 LIMIT 1');
        if (defaultPlanResult.rows.length > 0) {
            const planId = defaultPlanResult.rows[0].id;
            const subResult = await client.query(`
                INSERT INTO assinaturas (usuario_id, plano_id, realm_id, status, data_inicio, data_fim, valor_assinatura)
                VALUES ($1, $2, $3, 'trial', NOW(), NOW() + INTERVAL '30 days', 0)
                RETURNING id
            `, [userId, planId, realmId]);

            const subscriptionId = subResult.rows[0].id;

            // Update realm with current subscription
            await client.query(
                'UPDATE realms SET assinatura_atual_id = $1, status_assinatura = $2 WHERE id = $3',
                [subscriptionId, 'trial', realmId]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({ user: userResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Register error:', err);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    } finally {
        client.release();
    }
});

// Create Team Member (Only Master or Admin can create users in their realm)
router.post('/team', verifyToken, isMaster, async (req, res) => {
    try {
        const { nome, email, senha, role, is_master } = req.body;
        const { realm_id } = req.user;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
        }

        const existing = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email já cadastrado.' });
        }

        const senha_hash = await bcrypt.hash(senha, 12);

        // Members created by Team Management always belong to the same realm
        const userRole = role || 'gestor';
        const userIsMaster = is_master === true;

        const result = await pool.query(
            'INSERT INTO usuarios (nome, email, senha_hash, role, realm_id, is_master) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nome, email, role, is_master, created_at',
            [nome, email, senha_hash, userRole, realm_id, userIsMaster]
        );

        res.status(201).json({ user: result.rows[0] });
    } catch (err) {
        console.error('Create team member error:', err);
        res.status(500).json({ error: 'Erro ao criar membro da equipe.' });
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
            {
                id: user.id,
                email: user.email,
                nome: user.nome,
                role: user.role || 'gestor',
                realm_id: user.realm_id,
                is_master: user.is_master,
                is_system_admin: user.is_system_admin
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' } // Increased for better UX in SaaS
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
                id: user.id,
                nome: user.nome,
                email: user.email,
                role: user.role || 'gestor',
                realm_id: user.realm_id,
                is_master: user.is_master
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
        const result = await pool.query('SELECT * FROM usuarios WHERE id = $1 AND refresh_token = $2', [decoded.id, refreshToken]);

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Refresh token inválido.' });
        }

        const user = result.rows[0];

        const newAccessToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                nome: user.nome,
                role: user.role || 'gestor',
                realm_id: user.realm_id,
                is_master: user.is_master
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
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
                id: user.id,
                nome: user.nome,
                email: user.email,
                role: user.role || 'gestor',
                realm_id: user.realm_id,
                is_master: user.is_master
            }
        });
    } catch (err) {
        console.error('Refresh error:', err);
        res.status(403).json({ error: 'Refresh token inválido ou expirado.' });
    }
});

// Get Team Members (Realm restricted)
router.get('/team', verifyToken, async (req, res) => {
    try {
        const { realm_id } = req.user;
        const result = await pool.query(
            'SELECT id, nome, email, role, is_master, created_at, updated_at FROM usuarios WHERE realm_id = $1 ORDER BY created_at DESC',
            [realm_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('List team error:', err);
        res.status(500).json({ error: 'Erro ao listar membros da equipe.' });
    }
});

// Update Team Member role/master (Master only)
router.put('/team/:id', verifyToken, isMaster, async (req, res) => {
    try {
        const { role, is_master } = req.body;
        const userId = req.params.id;
        const { realm_id } = req.user;

        const result = await pool.query(
            'UPDATE usuarios SET role = COALESCE($1, role), is_master = COALESCE($2, is_master), updated_at = NOW() WHERE id = $3 AND realm_id = $4 RETURNING id, nome, email, role, is_master',
            [role, is_master, userId, realm_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Membro da equipe não encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update team error:', err);
        res.status(500).json({ error: 'Erro ao atualizar membro da equipe.' });
    }
});

// Delete Team Member (Master only)
router.delete('/team/:id', verifyToken, isMaster, async (req, res) => {
    try {
        const userId = req.params.id;
        const { realm_id } = req.user;

        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Não é possível remover seu próprio usuário.' });
        }

        const result = await pool.query('DELETE FROM usuarios WHERE id = $1 AND realm_id = $2 RETURNING id', [userId, realm_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Membro da equipe não encontrado.' });
        }

        res.json({ message: 'Membro da equipe removido com sucesso.' });
    } catch (err) {
        console.error('Delete team member error:', err);
        res.status(500).json({ error: 'Erro ao remover membro da equipe.' });
    }
});

module.exports = router;
