const pool = require('./db/pool');

async function checkTable() {
    try {
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'unidades'
            );
        `);
        console.log('Unidades table exists:', res.rows[0].exists);

        if (res.rows[0].exists) {
            const count = await pool.query('SELECT COUNT(*) FROM unidades');
            console.log('Units count:', count.rows[0].count);
        }
    } catch (err) {
        console.error('DB Check error:', err);
    } finally {
        pool.end();
    }
}

checkTable();
