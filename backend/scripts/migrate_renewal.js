const pool = require('../db/pool');

async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS contrato_renovacoes (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                contrato_id UUID REFERENCES contratos(id) ON DELETE CASCADE,
                data_renovacao TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                valor_anterior NUMERIC(12, 2),
                valor_novo NUMERIC(12, 2),
                data_inicio_novo DATE,
                data_fim_novo DATE,
                observacoes TEXT,
                indice_reajuste VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_renovacoes_contrato ON contrato_renovacoes(contrato_id);
        `);
        console.log('Migration successful: contrato_renovacoes created.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        // We don't want to hang the process, but pool might keep it open.
        // Usually scripts just run and exit.
        process.exit(0);
    }
}

migrate();
