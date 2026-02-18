const pool = require('../db/pool');

async function test() {
    try {
        console.log('Testing GET /contratos/parcelas/filtro query...');

        // Mock query params consistent with default frontend state
        const dt_inicio = '2026-01-01';
        const dt_fim = '2027-12-31';
        const status = 'pendente';

        let query = `
            SELECT cp.*, 
                c.id as contrato_id,
                i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf,
                u.identificador AS unidade_identificador, u.tipo_unidade,
                p.nome AS imovel_nome, p.endereco AS imovel_endereco, p.cidade AS imovel_cidade
            FROM contrato_parcelas cp
            LEFT JOIN contratos c ON cp.contrato_id = c.id
            LEFT JOIN inquilinos i ON cp.inquilino_id = i.id
            LEFT JOIN unidades u ON cp.unidade_id = u.id
            LEFT JOIN propriedades p ON u.propriedade_id = p.id
            WHERE 1=1
        `;

        const params = [];
        let paramIndex = 1;

        if (dt_inicio) {
            query += ` AND cp.data_vencimento >= $${paramIndex++}`;
            params.push(dt_inicio);
        }
        if (dt_fim) {
            query += ` AND cp.data_vencimento <= $${paramIndex++}`;
            params.push(dt_fim);
        }
        if (status && status !== 'todos') {
            query += ` AND cp.status_pagamento = $${paramIndex++}`;
            params.push(status);
        }

        query += ` ORDER BY cp.data_vencimento ASC, i.nome_completo ASC`;

        console.log('Query:', query);
        console.log('Params:', params);

        const result = await pool.query(query, params);
        console.log(`Query success! Found ${result.rows.length} rows.`);

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        pool.end();
    }
}

test();
