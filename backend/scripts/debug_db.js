const pool = require('../db/pool');

async function debug() {
    try {
        console.log('Checking database tables...');
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables found:', tables.rows.map(r => r.table_name));

        const hasRenovacoes = tables.rows.some(r => r.table_name === 'contrato_renovacoes');
        if (!hasRenovacoes) {
            console.error('CRITICAL: Table contrato_renovacoes DOES NOT EXIST!');
        } else {
            console.log('OK: Table contrato_renovacoes exists.');
        }

        console.log('\nFetching one contract to test GET /:id logic...');
        const contract = await pool.query('SELECT id FROM contratos LIMIT 1');
        if (contract.rows.length === 0) {
            console.log('No contracts found to test.');
        } else {
            const id = contract.rows[0].id;
            console.log(`Testing fetch for Contract ID: ${id}`);
            
            try {
                const renovacoes = await pool.query('SELECT * FROM contrato_renovacoes WHERE contrato_id = $1', [id]);
                console.log('Fetch renovacoes success:', renovacoes.rows);
            } catch (err) {
                console.error('Error fetching renovacoes:', err.message);
            }
        }

    } catch (err) {
        console.error('Debug script error:', err);
    } finally {
        pool.end();
    }
}

debug();
