const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

const isValidUUID = (id) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
const isValidDate = (d) => !isNaN(Date.parse(d));



// Helper: generate installments for a contract
function generateParcelas(dataInicio, dataFim, valorInicial, diaVencimento, breakdown = {}) {
    const parcelas = [];
    const start = new Date(dataInicio);
    const end = new Date(dataFim);
    let current = new Date(start);
    let numero = 1;

    // Breakdown defaults
    const {
        valor_iptu = 0,
        valor_agua = 0,
        valor_luz = 0,
        valor_outros = 0
    } = breakdown;

    while (current < end) {
        const periodoInicio = new Date(current);
        const periodoFim = new Date(current);
        periodoFim.setMonth(periodoFim.getMonth() + 1);
        periodoFim.setDate(periodoFim.getDate() - 1);

        if (periodoFim > end) {
            periodoFim.setTime(end.getTime());
        }

        const vencimento = new Date(periodoInicio.getFullYear(), periodoInicio.getMonth(), diaVencimento);
        if (vencimento < periodoInicio) {
            vencimento.setMonth(vencimento.getMonth() + 1);
        }

        const descricao = `Aluguel ${periodoInicio.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}`;

        parcelas.push({
            numero_parcela: numero,
            periodo_inicio: periodoInicio.toISOString().split('T')[0],
            periodo_fim: periodoFim.toISOString().split('T')[0],
            valor_base: valorInicial,
            valor_iptu,
            valor_agua,
            valor_luz,
            valor_outros,
            desconto_pontualidade: 0,
            data_vencimento: vencimento.toISOString().split('T')[0],
            status_pagamento: 'pendente',
            descricao
        });

        current.setMonth(current.getMonth() + 1);
        numero++;
    }

    return parcelas;
}

// List all contracts (with joins)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT c.*, 
        i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf, i.restricoes AS inquilino_restricoes,
        u.identificador AS unidade_identificador, u.tipo_unidade,
        p.endereco AS imovel_endereco, p.numero AS imovel_numero, p.cidade AS imovel_cidade, p.nome AS imovel_nome
      FROM contratos c
      JOIN inquilinos i ON c.inquilino_id = i.id
      JOIN unidades u ON c.unidade_id = u.id
      JOIN propriedades p ON u.propriedade_id = p.id
      ORDER BY c.created_at DESC
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('List contracts error:', err);
        res.status(500).json({ error: 'Erro ao listar contratos.' });
    }
});

// Get single contract with installments and renewals
router.get('/:id', async (req, res) => {
    try {
        const contractResult = await pool.query(`
      SELECT c.*, 
        i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf, i.restricoes AS inquilino_restricoes,
        u.identificador AS unidade_identificador, u.tipo_unidade,
        p.endereco AS imovel_endereco, p.numero AS imovel_numero, p.cidade AS imovel_cidade, p.nome AS imovel_nome
      FROM contratos c
      JOIN inquilinos i ON c.inquilino_id = i.id
      JOIN unidades u ON c.unidade_id = u.id
      JOIN propriedades p ON u.propriedade_id = p.id
      WHERE c.id = $1
    `, [req.params.id]);

        if (contractResult.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }

        const parcelasResult = await pool.query(
            'SELECT * FROM contrato_parcelas WHERE contrato_id = $1 ORDER BY numero_parcela',
            [req.params.id]
        );

        const renovacoesResult = await pool.query(
            'SELECT * FROM contrato_renovacoes WHERE contrato_id = $1 ORDER BY data_renovacao DESC',
            [req.params.id]
        );

        res.json({
            ...contractResult.rows[0],
            parcelas: parcelasResult.rows,
            renovacoes: renovacoesResult.rows
        });
    } catch (err) {
        console.error('Get contract error:', err);
        res.status(500).json({ error: 'Erro ao buscar contrato.' });
    }
});

// Renew contract (Renovar)
router.post('/:id/renovar', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const contratoId = req.params.id;
        const { nova_data_fim, novo_valor, indice_reajuste, observacoes } = req.body;

        if (!nova_data_fim || !novo_valor) {
            return res.status(400).json({ error: 'Nova data fim e novo valor são obrigatórios.' });
        }

        // 1. Get current contract
        const contractRes = await client.query('SELECT * FROM contratos WHERE id = $1', [contratoId]);
        if (contractRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }
        const contrato = contractRes.rows[0];

        // 2. Insert into history
        await client.query(
            `INSERT INTO contrato_renovacoes (
                contrato_id, valor_anterior, valor_novo, 
                data_inicio_novo, data_fim_novo, 
                observacoes, indice_reajuste
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                contratoId, contrato.valor_inicial, novo_valor,
                contrato.data_fim, nova_data_fim, // Start of new period is implicitly the old end date? Or just record the change.
                observacoes, indice_reajuste
            ]
        );

        // 3. Update contract
        // We update data_fim to extend it. We update valor_inicial to the new rent.
        const updatedContract = await client.query(
            `UPDATE contratos SET 
                data_fim = $1, 
                valor_inicial = $2,
                updated_at = NOW()
             WHERE id = $3 RETURNING *`,
            [nova_data_fim, novo_valor, contratoId]
        );

        await client.query('COMMIT');
        res.json(updatedContract.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Renew contract error:', err);
        res.status(500).json({ error: 'Erro ao renovar contrato.' });
    } finally {
        client.release();
    }
});

// Create contract (auto-generates installments)
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            inquilino_id, unidade_id, data_inicio, data_fim, qtd_ocupantes,
            valor_inicial, dia_vencimento, observacoes_contrato,
            valor_iptu, valor_agua, valor_luz, valor_outros
        } = req.body;

        if (!inquilino_id || !unidade_id || !data_inicio || !data_fim || !valor_inicial || !dia_vencimento) {
            return res.status(400).json({ error: 'Inquilino, unidade, datas, valor e dia de vencimento são obrigatórios.' });
        }

        const contractResult = await client.query(
            `INSERT INTO contratos (
                inquilino_id, unidade_id, data_inicio, data_fim, qtd_ocupantes, 
                valor_inicial, dia_vencimento, observacoes_contrato,
                valor_iptu, valor_agua, valor_luz, valor_outros
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [
                inquilino_id, unidade_id, data_inicio, data_fim, qtd_ocupantes || 1,
                valor_inicial, dia_vencimento, observacoes_contrato,
                valor_iptu || 0, valor_agua || 0, valor_luz || 0, valor_outros || 0
            ]
        );

        const contrato = contractResult.rows[0];

        // Auto-generate installments with breakdown
        const parcelas = generateParcelas(
            data_inicio, data_fim, valor_inicial, dia_vencimento,
            { valor_iptu, valor_agua, valor_luz, valor_outros }
        );

        for (const p of parcelas) {
            await client.query(
                `INSERT INTO contrato_parcelas (
                    contrato_id, unidade_id, inquilino_id, numero_parcela, 
                    periodo_inicio, periodo_fim, valor_base, 
                    valor_iptu, valor_agua, valor_luz, valor_outros,
                    desconto_pontualidade, data_vencimento, status_pagamento, descricao
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [
                    contrato.id, unidade_id, inquilino_id, p.numero_parcela,
                    p.periodo_inicio, p.periodo_fim, p.valor_base,
                    p.valor_iptu, p.valor_agua, p.valor_luz, p.valor_outros,
                    p.desconto_pontualidade, p.data_vencimento, p.status_pagamento, p.descricao
                ]
            );
        }

        // Update unit status
        await client.query("UPDATE unidades SET status = 'alugado', updated_at = NOW() WHERE id = $1", [unidade_id]);

        await client.query('COMMIT');

        // Fetch full contract with parcelas
        const fullContract = await pool.query(`
      SELECT c.*, 
        i.nome_completo AS inquilino_nome,
        u.identificador AS unidade_identificador,
        p.endereco AS imovel_endereco
      FROM contratos c
      JOIN inquilinos i ON c.inquilino_id = i.id
      JOIN unidades u ON c.unidade_id = u.id
      JOIN propriedades p ON u.propriedade_id = p.id
      WHERE c.id = $1
    `, [contrato.id]);

        const parcelasResult = await pool.query(
            'SELECT * FROM contrato_parcelas WHERE contrato_id = $1 ORDER BY numero_parcela',
            [contrato.id]
        );

        res.status(201).json({
            ...fullContract.rows[0],
            parcelas: parcelasResult.rows
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create contract error:', err);
        res.status(500).json({ error: 'Erro ao criar contrato.' });
    } finally {
        client.release();
    }
});

// Update contract
router.put('/:id', async (req, res) => {
    try {
        const {
            data_inicio, data_fim, qtd_ocupantes, valor_inicial, dia_vencimento, observacoes_contrato,
            valor_iptu, valor_agua, valor_luz, valor_outros
        } = req.body;

        const result = await pool.query(
            `UPDATE contratos SET
        data_inicio = COALESCE($1, data_inicio),
        data_fim = COALESCE($2, data_fim),
        qtd_ocupantes = COALESCE($3, qtd_ocupantes),
        valor_inicial = COALESCE($4, valor_inicial),
        dia_vencimento = COALESCE($5, dia_vencimento),
        observacoes_contrato = COALESCE($6, observacoes_contrato),
        valor_iptu = COALESCE($7, valor_iptu),
        valor_agua = COALESCE($8, valor_agua),
        valor_luz = COALESCE($9, valor_luz),
        valor_outros = COALESCE($10, valor_outros),
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
            [
                data_inicio, data_fim, qtd_ocupantes, valor_inicial, dia_vencimento, observacoes_contrato,
                valor_iptu, valor_agua, valor_luz, valor_outros,
                req.params.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update contract error:', err);
        res.status(500).json({ error: 'Erro ao atualizar contrato.' });
    }
});

// Close (encerrar) contract
router.patch('/:id/encerrar', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE contratos SET status_encerrado = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }

        // Update unit status back to available
        await client.query(
            "UPDATE unidades SET status = 'disponivel', updated_at = NOW() WHERE id = $1",
            [result.rows[0].unidade_id]
        );

        // Cancel pending installments
        await client.query(
            `UPDATE contrato_parcelas SET status_pagamento = 'cancelado', updated_at = NOW()
       WHERE contrato_id = $1 AND status_pagamento = 'pendente'`,
            [req.params.id]
        );

        await client.query('COMMIT');
        res.json({ message: 'Contrato encerrado com sucesso.', contrato: result.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Close contract error:', err);
        res.status(500).json({ error: 'Erro ao encerrar contrato.' });
    } finally {
        client.release();
    }
});

// Delete contract
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM contratos WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }
        res.json({ message: 'Contrato removido com sucesso.' });
    } catch (err) {
        console.error('Delete contract error:', err);
        res.status(500).json({ error: 'Erro ao remover contrato.' });
    }
});

// Create standalone installment (avulso)
router.post('/parcelas/avulso', async (req, res) => {
    try {
        const {
            unidade_id, inquilino_id, descricao,
            data_vencimento, valor_base,
            valor_iptu, valor_agua, valor_luz, valor_outros,
            observacoes
        } = req.body;

        if (!unidade_id || !data_vencimento) {
            return res.status(400).json({ error: 'Unidade e vencimento são obrigatórios.' });
        }

        // Try to find an active contract to link
        let contrato_id = null;
        if (unidade_id) {
            const activeContract = await pool.query(
                `SELECT id FROM contratos 
                 WHERE unidade_id = $1 AND status_encerrado = false 
                 ORDER BY created_at DESC LIMIT 1`,
                [unidade_id]
            );
            if (activeContract.rows.length > 0) {
                contrato_id = activeContract.rows[0].id;
            }
        }

        const result = await pool.query(
            `INSERT INTO contrato_parcelas (
                contrato_id, unidade_id, inquilino_id, descricao, data_vencimento,
                valor_base, valor_iptu, valor_agua, valor_luz, valor_outros,
                observacoes, status_pagamento
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendente')
            RETURNING *`,
            [
                contrato_id, unidade_id, inquilino_id, descricao, data_vencimento,
                valor_base || 0, valor_iptu || 0, valor_agua || 0, valor_luz || 0, valor_outros || 0,
                observacoes
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create standalone installment error:', err);
        res.status(500).json({ error: 'Erro ao criar parcela avulsa.' });
    }
});

// ===== INSTALLMENT (PARCELA) SUB-ROUTES =====

// Filtered installments (for Boletos page)
router.get('/parcelas/filtro', async (req, res) => {
    try {
        const { dt_inicio, dt_fim, status, imovel_id, inquilino_id } = req.query;

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
        res.json(result.rows);
    } catch (err) {
        console.error('Filter installments error:', err);
        res.status(500).json({ error: 'Erro ao buscar boletos: ' + err.message });
    }
});

// Get single installment with details (for printing)
router.get('/parcelas/:id', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) {
            return res.status(400).json({ error: 'ID da parcela inválido.' });
        }

        const result = await pool.query(`
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
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get installment error:', err);
        res.status(500).json({ error: 'Erro ao buscar parcela: ' + err.message });
    }
});

// Get installments for a contract
router.get('/:id/parcelas', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM contrato_parcelas WHERE contrato_id = $1 ORDER BY numero_parcela',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('List installments error:', err);
        res.status(500).json({ error: 'Erro ao listar parcelas.' });
    }
});

// Update installment (payment, discount, etc.)
router.patch('/parcelas/:parcelaId', async (req, res) => {
    try {
        const {
            valor_base, valor_iptu, valor_agua, valor_luz, valor_outros,
            desconto_pontualidade, data_pagamento, valor_pago, status_pagamento, observacoes
        } = req.body;

        const result = await pool.query(
            `UPDATE contrato_parcelas SET
        valor_base = COALESCE($1, valor_base),
        valor_iptu = COALESCE($2, valor_iptu),
        valor_agua = COALESCE($3, valor_agua),
        valor_luz = COALESCE($4, valor_luz),
        valor_outros = COALESCE($5, valor_outros),
        desconto_pontualidade = COALESCE($6, desconto_pontualidade),
        data_pagamento = COALESCE($7, data_pagamento),
        valor_pago = COALESCE($8, valor_pago),
        status_pagamento = COALESCE($9, status_pagamento),
        observacoes = COALESCE($10, observacoes),
        updated_at = NOW()
       WHERE id = $11 RETURNING *`,
            [
                valor_base, valor_iptu, valor_agua, valor_luz, valor_outros,
                desconto_pontualidade, data_pagamento, valor_pago, status_pagamento, observacoes,
                req.params.parcelaId
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update installment error:', err);
        res.status(500).json({ error: 'Erro ao atualizar parcela.' });
    }
});

// Delete installment (manually generated or otherwise)
router.delete('/parcelas/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM contrato_parcelas WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada.' });
        }
        res.json({ message: 'Parcela removida com sucesso.' });
    } catch (err) {
        console.error('Delete installment error:', err);
        res.status(500).json({ error: 'Erro ao remover parcela.' });
    }
});

// Filtered installments (for Boletos page)


// Bulk update installments status
router.post('/parcelas/bulk-update', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { ids, status } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'IDs são obrigatórios.' });
        }
        if (!status) {
            return res.status(400).json({ error: 'Novo status é obrigatório.' });
        }

        const validStatuses = ['pendente', 'pago', 'atrasado', 'cancelado'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Status inválido.' });
        }

        // Update all
        await client.query(
            `UPDATE contrato_parcelas 
             SET status_pagamento = $1, updated_at = NOW(),
                 data_pagamento = CASE WHEN $1 = 'pago' THEN CURRENT_DATE ELSE data_pagamento END
             WHERE id = ANY($2::uuid[])`,
            [status, ids]
        );

        await client.query('COMMIT');
        res.json({ message: 'Parcelas atualizadas com sucesso.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Bulk update error:', err);
        res.status(500).json({ error: 'Erro ao atualizar parcelas.' });
    } finally {
        client.release();
    }
});

// Generate installments (Next, Manual, or All)
router.post('/:id/parcelas/gerar', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const contratoId = req.params.id;
        const { mode = 'next', data_vencimento, valor, count } = req.body; // mode: 'next', 'manual', 'all'

        // 1. Fetch contract
        const contractRes = await client.query('SELECT * FROM contratos WHERE id = $1', [contratoId]);
        if (contractRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }
        const contrato = contractRes.rows[0];

        if (contrato.status_encerrado) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Não é possível gerar parcelas para um contrato encerrado.' });
        }

        const generated = [];

        // Helper to insert a parcel
        const insertParcela = async (numero, pInicio, pFim, dtVenc, valorBase) => {
            const descricao = `Aluguel ${pInicio.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}`;
            const res = await client.query(
                `INSERT INTO contrato_parcelas (
                    contrato_id, unidade_id, inquilino_id, numero_parcela, 
                    periodo_inicio, periodo_fim, valor_base, 
                    valor_iptu, valor_agua, valor_luz, valor_outros,
                    desconto_pontualidade, data_vencimento, status_pagamento, descricao
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pendente', $14)
                RETURNING *`,
                [
                    contrato.id, contrato.unidade_id, contrato.inquilino_id, numero,
                    pInicio, pFim, valorBase,
                    contrato.valor_iptu, contrato.valor_agua, contrato.valor_luz, contrato.valor_outros,
                    0, dtVenc, descricao
                ]
            );
            return res.rows[0];
        };

        // 2. Find last installment
        const lastParcelaRes = await client.query(
            'SELECT * FROM contrato_parcelas WHERE contrato_id = $1 ORDER BY numero_parcela DESC LIMIT 1',
            [contratoId]
        );

        let nextNum = 1;
        let nextStart = new Date(contrato.data_inicio);

        if (lastParcelaRes.rows.length > 0) {
            const last = lastParcelaRes.rows[0];
            nextNum = last.numero_parcela + 1;
            nextStart = new Date(last.periodo_inicio);
            nextStart.setMonth(nextStart.getMonth() + 1);
        }

        if (mode === 'manual') {
            if (!data_vencimento) throw new Error('Data de vencimento é obrigatória para modo manual.');

            const pInicio = new Date(nextStart);
            const pFim = new Date(pInicio);
            pFim.setMonth(pFim.getMonth() + 1);
            pFim.setDate(pFim.getDate() - 1);

            const pVal = valor ? parseFloat(valor) : parseFloat(contrato.valor_inicial);
            const pVenc = new Date(data_vencimento);

            generated.push(await insertParcela(nextNum, pInicio, pFim, pVenc, pVal));

        } else if (mode === 'all') {
            // Generate until contract end
            const dtFimContrato = new Date(contrato.data_fim);
            let currentStart = new Date(nextStart);
            let currentNum = nextNum;

            while (currentStart < dtFimContrato) {
                const pInicio = new Date(currentStart);
                const pFim = new Date(pInicio);
                pFim.setMonth(pFim.getMonth() + 1);
                pFim.setDate(pFim.getDate() - 1);

                // Default vencimento logic
                let pVenc = new Date(pInicio.getFullYear(), pInicio.getMonth(), contrato.dia_vencimento);
                if (pVenc < pInicio) pVenc.setMonth(pVenc.getMonth() + 1);

                generated.push(await insertParcela(currentNum, pInicio, pFim, pVenc, parseFloat(contrato.valor_inicial)));

                // Advance
                currentStart.setMonth(currentStart.getMonth() + 1);
                currentNum++;

                // Safety break to prevent infinite loops if dates are weird
                if (currentNum > 120) break;
            }
        } else {
            // mode === 'next' (original logic)
            const pInicio = new Date(nextStart);
            const pFim = new Date(pInicio);
            pFim.setMonth(pFim.getMonth() + 1);
            pFim.setDate(pFim.getDate() - 1);

            let pVenc = new Date(pInicio.getFullYear(), pInicio.getMonth(), contrato.dia_vencimento);
            if (pVenc < pInicio) pVenc.setMonth(pVenc.getMonth() + 1);

            generated.push(await insertParcela(nextNum, pInicio, pFim, pVenc, parseFloat(contrato.valor_inicial)));
        }

        await client.query('COMMIT');
        res.status(201).json(generated);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Generate installment error:', err);
        res.status(500).json({ error: 'Erro ao gerar parcela: ' + err.message });
    } finally {
        client.release();
    }
});

// Generate Boleto PDF
router.get('/parcelas/:id/boleto', async (req, res) => {
    try {
        if (!isValidUUID(req.params.id)) {
            return res.status(400).json({ error: 'ID da parcela inválido.' });
        }

        // Fetch installment details with joined data
        const result = await pool.query(`
            SELECT cp.*, 
                c.id as contrato_id,
                i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf, i.email AS inquilino_email,
                p.endereco AS imovel_endereco, p.cidade AS imovel_cidade, p.uf AS imovel_uf, p.cep as imovel_cep,
                u.identificador AS unidade_identificador
            FROM contrato_parcelas cp
            LEFT JOIN contratos c ON cp.contrato_id = c.id
            LEFT JOIN inquilinos i ON cp.inquilino_id = i.id OR c.inquilino_id = i.id
            LEFT JOIN unidades u ON cp.unidade_id = u.id OR c.unidade_id = u.id
            LEFT JOIN propriedades p ON u.propriedade_id = p.id
            WHERE cp.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada.' });
        }

        const parcela = result.rows[0];
        const Boleto = require('node-boleto').Boleto;

        // Calculate total value
        const valorTotal = (
            Number(parcela.valor_base) +
            Number(parcela.valor_iptu) +
            Number(parcela.valor_agua) +
            Number(parcela.valor_luz) +
            Number(parcela.valor_outros)
        ).toFixed(2);

        // Dummy Bank Data (Banco do Brasil Test)
        const boleto = new Boleto({
            'banco': 'santander', // Using Santander as example or 'bb'
            'data_emissao': new Date(),
            'data_vencimento': new Date(parcela.data_vencimento), // Date object
            'valor': Math.round(valorTotal * 100), // In cents
            'nosso_numero': parcela.numero_parcela ? `0000000${parcela.numero_parcela}` : '00000000001',
            'numero_documento': parcela.id.substring(0, 10),
            'cedente': 'Gestão Imóveis Ltda',
            'cedente_cnpj': '12.345.678/0001-90', // Dummy
            'agencia': '1234',
            'codigo_cedente': '123456', // Conta?
            'carteira': '102',
            'pagador': parcela.inquilino_nome,
            'local_de_pagamento': 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO.',
            'instrucoes': [
                'Sr. Caixa, aceitar o pagamento após o vencimento com juros de dia.',
                `Referente a: ${parcela.descricao || 'Aluguel'}`
            ],
        });

        boleto.renderHTML((html) => {
            // Inject custom print styles for better A4 fit
            const printStyles = `
                <style>
                    @media print {
                        body { margin: 0; padding: 0; }
                        .boleto-viewer { transform: scale(0.95); transform-origin: top center; }
                    }
                </style>
            `;
            const styledHtml = html.replace('</body>', `${printStyles}</body>`);
            return res.send(styledHtml);
        });

    } catch (err) {
        console.error('Generate boleto error:', err);
        res.status(500).json({ error: 'Erro ao gerar boleto: ' + err.message });
    }
});

module.exports = router;
