const pool = require('../db/pool');

async function test() {
    try {
        console.log('Fetching contracts...');
        const res = await pool.query('SELECT id FROM contratos LIMIT 1');
        if (res.rows.length === 0) {
            console.log('No contracts found.');
            return;
        }
        const contractId = res.rows[0].id;
        console.log('Contract ID:', contractId);

        console.log('Fetching parcels for contract...');
        const res2 = await pool.query('SELECT id FROM contrato_parcelas WHERE contrato_id = $1 LIMIT 1', [contractId]);
        if (res2.rows.length === 0) {
            console.log('No parcels found for this contract.');
            return;
        }
        const parcelId = res2.rows[0].id;
        console.log('Parcel ID:', parcelId);

        console.log('Testing GET /contratos/parcelas/:id query...');
        // Simulating the query from contracts.js
        const query = `
            SELECT cp.*, 
                c.id as contrato_id,
                i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf,
                u.identificador AS unidade_identificador, u.tipo_unidade,
                p.endereco AS imovel_endereco, p.numero AS imovel_numero, p.cidade AS imovel_cidade, p.nome AS imovel_nome
            FROM contrato_parcelas cp
            LEFT JOIN contratos c ON cp.contrato_id = c.id
            LEFT JOIN inquilinos i ON cp.inquilino_id = i.id OR c.inquilino_id = i.id
            LEFT JOIN unidades u ON cp.unidade_id = u.id OR c.unidade_id = u.id
            LEFT JOIN propriedades p ON u.propriedade_id = p.id
            WHERE cp.id = $1
        `;

        const res3 = await pool.query(query, [parcelId]);
        console.log('Query success!');
        console.log('Row:', res3.rows[0]);

    } catch (err) {
        console.error('Test failed:', err);
    } finally {
        pool.end();
    }
}

test();
