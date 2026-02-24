const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function initAdmin() {
    try {
        const name = process.env.ADMIN_NAME || 'Administrador Master';
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.log('[SEED] ADMIN_EMAIL ou ADMIN_PASSWORD não configurados. Pulando criação de admin master.');
            return;
        }

        // Check if ANY admin exists or if this specific email exists
        const existingAdmin = await pool.query("SELECT id FROM usuarios WHERE is_admin = TRUE OR email = $1 LIMIT 1", [email]);

        if (existingAdmin.rows.length === 0) {
            console.log(`[SEED] Criando usuário admin master: ${email}`);
            const hashedPassword = await bcrypt.hash(password, 12);

            await pool.query(
                "INSERT INTO usuarios (nome, email, senha_hash, is_admin) VALUES ($1, $2, $3, TRUE)",
                [name, email, hashedPassword]
            );
            console.log('[SEED] Admin master criado com sucesso.');
        } else {
            console.log('[SEED] Usuário administrador já existe no sistema.');
        }
    } catch (err) {
        console.error('[SEED] Erro ao inicializar admin master:', err);
    }
}

module.exports = { initAdmin };
