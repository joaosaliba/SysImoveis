const pool = require('../db/pool');

const isValidUUID = (id) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
const isValidDate = (d) => !isNaN(Date.parse(d));

async function testQuery(paramsObj) {
    try {
        console.log('Testing with params:', paramsObj);

        const { dt_inicio, dt_fim, status, imovel_id, inquilino_id } = paramsObj;

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

        if (dt_inicio && isValidDate(dt_inicio)) {
            query += ` AND cp.data_vencimento >= $${paramIndex++}`;
            params.push(dt_inicio);
        }
        if (dt_fim && isValidDate(dt_fim)) {
            query += ` AND cp.data_vencimento <= $${paramIndex++}`;
            params.push(dt_fim);
        }

        const validStatuses = ['pendente', 'pago', 'atrasado', 'cancelado'];
        if (status && status !== 'todos' && validStatuses.includes(status)) {
            query += ` AND cp.status_pagamento = $${paramIndex++}`;
            params.push(status);
        }
        if (imovel_id && isValidUUID(imovel_id)) {
            query += ` AND p.id = $${paramIndex++}`;
            params.push(imovel_id);
        }
        if (inquilino_id && isValidUUID(inquilino_id)) {
            query += ` AND cp.inquilino_id = $${paramIndex++}`;
            params.push(inquilino_id);
        }

        query += ` ORDER BY cp.data_vencimento ASC, i.nome_completo ASC`;

        const result = await pool.query(query, params);
        console.log(`Success! Rows: ${result.rows.length}`);
    } catch (err) {
        console.error('FAILED:', err.message);
    }
}

async function run() {
    await testQuery({ dt_inicio: '2026-01-01', dt_fim: '2027-12-31' }); // Basic
    await testQuery({ status: 'pendente' }); // Status
    await testQuery({ imovel_id: 'undefined' }); // Invalid UUID string
    await testQuery({ imovel_id: 'invalid-uuid' }); // Another invalid
    await testQuery({ imovel_id: '123e4567-e89b-12d3-a456-426614174000' }); // Valid UUID (random)
    await testQuery({ status: 'undefined' }); // "undefined" status
    await testQuery({ dt_inicio: 'invalid-date' }); // Invalid date

    pool.end();
}

run();
