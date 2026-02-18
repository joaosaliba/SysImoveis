const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Boleto = require('node-boleto').Boleto;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testBoleto() {
    try {
        // 1. Get a parcel
        const res = await pool.query(`
            SELECT cp.*, i.nome_completo as inquilino_nome 
            FROM contrato_parcelas cp
            JOIN inquilinos i ON cp.inquilino_id = i.id
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log('No parcels found to test.');
            return;
        }

        const parcela = res.rows[0];
        console.log('Testing with parcel:', parcela.id);

        // 2. Create Boleto
        const valorTotal = (
            Number(parcela.valor_base) +
            Number(parcela.valor_iptu) +
            Number(parcela.valor_agua) +
            Number(parcela.valor_luz) +
            Number(parcela.valor_outros)
        ).toFixed(2);

        const boleto = new Boleto({
            'banco': 'santander',
            'data_emissao': new Date(),
            'data_vencimento': new Date(parcela.data_vencimento),
            'valor': Math.round(valorTotal * 100),
            'nosso_numero': '1234567',
            'numero_documento': '123',
            'cedente': 'Gestão Imóveis Ltda',
            'cedente_cnpj': '12.345.678/0001-90',
            'agencia': '1234',
            'codigo_cedente': '123456',
            'carteira': '102',
            'pagador': parcela.inquilino_nome || 'Inquilino Teste',
            'local_de_pagamento': 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO.',
            'instrucoes': ['Instrução 1', 'Instrução 2'],
        });

        console.log('Boleto object created. Rendering HTML...');

        boleto.renderHTML((html) => {
            if (html && html.length > 500) {
                console.log('SUCCESS: HTML generated with length:', html.length);
                console.log('Snippet:', html.substring(0, 100));
            } else {
                console.error('FAILURE: HTML empty or too short');
            }
            process.exit(0);
        });

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

testBoleto();
