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

        // Ensure default organization exists
        let orgResult = await pool.query("SELECT id FROM organizacoes WHERE slug = 'padrao' LIMIT 1");
        if (orgResult.rows.length === 0) {
            orgResult = await pool.query(
                "INSERT INTO organizacoes (nome, slug) VALUES ('Padrão', 'padrao') RETURNING id"
            );
        }
        const orgId = orgResult.rows[0].id;

        // Check if ANY admin exists or if this specific email exists
        const existingAdmin = await pool.query("SELECT id FROM usuarios WHERE is_admin = TRUE OR email = $1 LIMIT 1", [email]);

        if (existingAdmin.rows.length === 0) {
            console.log(`[SEED] Criando usuário admin master: ${email}`);
            const hashedPassword = await bcrypt.hash(password, 12);

            await pool.query(
                "INSERT INTO usuarios (nome, email, senha_hash, is_admin, organizacao_id) VALUES ($1, $2, $3, TRUE, $4)",
                [name, email, hashedPassword, orgId]
            );
            console.log('[SEED] Admin master criado com sucesso.');
        } else {
            // Ensure existing admin has an org
            await pool.query("UPDATE usuarios SET organizacao_id = $1 WHERE organizacao_id IS NULL AND is_admin = TRUE", [orgId]);
            console.log('[SEED] Usuário administrador já existe no sistema.');
        }
    } catch (err) {
        console.error('[SEED] Erro ao inicializar admin master:', err);
    }
}

module.exports = { initAdmin };

