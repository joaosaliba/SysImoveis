const express = require('express');
const pool = require('../db/pool');
const { verifyToken, checkPermission } = require('../middleware/auth');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');
const { logAudit } = require('../services/auditService');

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

    const {
        valor_iptu = 0,
        valor_agua = 0,
        valor_luz = 0,
        valor_outros = 0,
        desconto_pontualidade = 0
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
            desconto_pontualidade,
            data_vencimento: vencimento.toISOString().split('T')[0],
            status_pagamento: 'pendente',
            descricao
        });

        current.setMonth(current.getMonth() + 1);
        numero++;
    }

    return parcelas;
}

// List all contracts (with joins and pagination)
router.get('/', checkPermission('contratos', 'ver'), async (req, res) => {
    try {
        const { page, limit, status, imovel_id, inquilino_id } = req.query;
        const { offset, limit: limitNum, page: pageNum } = getPaginationParams(page, limit);

        let whereClause = 'WHERE 1=1';
        let params = [];
        let paramIndex = 1;

        if (status && status !== 'todos') {
            if (status === 'encerrado') {
                whereClause += ` AND c.status_encerrado = true`;
            } else if (status === 'ativo') {
                whereClause += ` AND c.status_encerrado = false`;
            }
        }
        if (imovel_id && isValidUUID(imovel_id)) {
            whereClause += ` AND p.id = $${paramIndex++}`;
            params.push(imovel_id);
        }
        if (inquilino_id && isValidUUID(inquilino_id)) {
            whereClause += ` AND c.inquilino_id = $${paramIndex++}`;
            params.push(inquilino_id);
        }

        // Count total
        const countQuery = `
      SELECT COUNT(*) FROM contratos c
      JOIN inquilinos i ON c.inquilino_id = i.id
      JOIN unidades u ON c.unidade_id = u.id
      JOIN propriedades p ON u.propriedade_id = p.id
      ${whereClause}
    `;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // Get paginated data
        const dataQuery = `
      SELECT c.*,
        i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf, i.restricoes AS inquilino_restricoes,
        u.identificador AS unidade_identificador, u.tipo_unidade,
        p.endereco AS imovel_endereco, p.numero AS imovel_numero, p.cidade AS imovel_cidade, p.nome AS imovel_nome
      FROM contratos c
      JOIN inquilinos i ON c.inquilino_id = i.id
      JOIN unidades u ON c.unidade_id = u.id
      JOIN propriedades p ON u.propriedade_id = p.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
        const dataParams = [...params, limitNum, offset];
        const result = await pool.query(dataQuery, dataParams);

        res.json(formatPaginatedResponse(result.rows, total, pageNum, limitNum));
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
        u.identificador AS unidade_identificador, u.tipo_unidade, u.propriedade_id,
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
        const { nova_data_inicio, nova_data_fim, novo_valor, indice_reajuste, observacoes } = req.body;

        if (!nova_data_inicio || !nova_data_fim || !novo_valor) {
            return res.status(400).json({ error: 'Data início, data fim e novo valor são obrigatórios.' });
        }

        // 1. Get current contract
        const contractRes = await client.query('SELECT * FROM contratos WHERE id = $1', [contratoId]);
        if (contractRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }
        const contrato = contractRes.rows[0];

        // 2. Overlap Validation
        // A new period [nova_data_inicio, nova_data_fim] cannot overlap with segments of the same contract
        // Historically, we only track the *current* period in `contratos`. 
        // We should check if nova_data_inicio is AFTER the current end? Actually, the user might be extending it.
        // The rule requested: "mensagem de erro caso periodo antigo se chocar com o novo"
        const currentStart = new Date(contrato.data_inicio);
        const currentEnd = new Date(contrato.data_fim);
        const newStart = new Date(nova_data_inicio);
        const newEnd = new Date(nova_data_fim);

        if (newStart <= currentEnd && newEnd >= currentStart) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'O novo período de renovação se sobrepõe ao período atual do contrato.' });
        }

        // 3. Insert into history
        await client.query(
            `INSERT INTO contrato_renovacoes (
                contrato_id, valor_anterior, valor_novo, 
                data_inicio_novo, data_fim_novo, 
                observacoes, indice_reajuste
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                contratoId, contrato.valor_inicial, novo_valor,
                nova_data_inicio, nova_data_fim,
                observacoes, indice_reajuste
            ]
        );

        // 4. Update contract
        // We update data_inicio and data_fim to the new period. We update valor_inicial to the new rent.
        const updatedContract = await client.query(
            `UPDATE contratos SET 
                data_inicio = $1,
                data_fim = $2, 
                valor_inicial = $3,
                updated_at = NOW()
             WHERE id = $4 RETURNING *`,
            [nova_data_inicio, nova_data_fim, novo_valor, contratoId]
        );

        await client.query('COMMIT');
        res.json(updatedContract.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Renew contract error:', err);
        res.status(500).json({ error: 'Erro ao renovar contrato: ' + err.message });
    } finally {
        client.release();
    }
});

// Create contract (auto-generates installments)
router.post('/', checkPermission('contratos', 'salvar'), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            inquilino_id, unidade_id, data_inicio, data_fim, qtd_ocupantes,
            valor_inicial, dia_vencimento, observacoes_contrato,
            valor_iptu, valor_agua, valor_luz, valor_outros, desconto_pontualidade
        } = req.body;

        if (!inquilino_id || !unidade_id || !data_inicio || !data_fim || !valor_inicial || !dia_vencimento) {
            return res.status(400).json({ error: 'Inquilino, unidade, datas, valor e dia de vencimento são obrigatórios.' });
        }

        const contractResult = await client.query(
            `INSERT INTO contratos (
                inquilino_id, unidade_id, data_inicio, data_fim, qtd_ocupantes, 
                valor_inicial, dia_vencimento, observacoes_contrato,
                valor_iptu, valor_agua, valor_luz, valor_outros, desconto_pontualidade
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
            [
                inquilino_id, unidade_id, data_inicio, data_fim, qtd_ocupantes || 1,
                valor_inicial, dia_vencimento, observacoes_contrato,
                valor_iptu || 0, valor_agua || 0, valor_luz || 0, valor_outros || 0,
                desconto_pontualidade || 0
            ]
        );

        const contrato = contractResult.rows[0];

        // Auto-generate installments with breakdown
        const parcelas = generateParcelas(
            data_inicio, data_fim, valor_inicial, dia_vencimento,
            { valor_iptu, valor_agua, valor_luz, valor_outros, desconto_pontualidade }
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

        logAudit(req, 'CRIAR', 'CONTRATO', contrato.id, null,
            { inquilino_id: contrato.inquilino_id, unidade_id: contrato.unidade_id, data_inicio, data_fim, valor_inicial },
            `Contrato criado para unidade ${unidade_id} (${parcelas.length} parcelas geradas).`
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
router.put('/:id', checkPermission('contratos', 'salvar'), async (req, res) => {
    try {
        const {
            data_inicio, data_fim, qtd_ocupantes, valor_inicial, dia_vencimento, observacoes_contrato,
            valor_iptu, valor_agua, valor_luz, valor_outros, desconto_pontualidade
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
        desconto_pontualidade = COALESCE($11, desconto_pontualidade),
        updated_at = NOW()
       WHERE id = $12 RETURNING *`,
            [
                data_inicio, data_fim, qtd_ocupantes, valor_inicial, dia_vencimento, observacoes_contrato,
                valor_iptu, valor_agua, valor_luz, valor_outros, desconto_pontualidade,
                req.params.id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }

        const contrato = result.rows[0];

        // Sync pending installments with new contract values
        await pool.query(
            `UPDATE contrato_parcelas SET
                valor_base = $1,
                valor_iptu = $2,
                valor_agua = $3,
                valor_luz = $4,
                valor_outros = $5,
                desconto_pontualidade = $6,
                updated_at = NOW()
             WHERE contrato_id = $7 AND status_pagamento = 'pendente'`,
            [
                contrato.valor_inicial,
                contrato.valor_iptu,
                contrato.valor_agua,
                contrato.valor_luz,
                contrato.valor_outros,
                contrato.desconto_pontualidade,
                contrato.id
            ]
        );

        logAudit(req, 'ATUALIZAR', 'CONTRATO', req.params.id, null,
            { valor_inicial, dia_vencimento, data_inicio, data_fim },
            `Contrato atualizado (parcelas pendentes sincronizadas).`
        );

        res.json(contrato);
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
        logAudit(req, 'ENCERRAR', 'CONTRATO', req.params.id, null,
            { status_encerrado: true },
            `Contrato encerrado. Parcelas pendentes canceladas.`
        );
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
router.delete('/:id', checkPermission('contratos', 'deletar'), async (req, res) => {
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
router.post('/parcelas/avulso', checkPermission('boletos', 'salvar'), async (req, res) => {
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
router.get('/parcelas/filtro', checkPermission('boletos', 'ver'), async (req, res) => {
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
            if (status === 'atrasado') {
                query += ` AND (cp.status_pagamento = 'atrasado' OR (cp.status_pagamento = 'pendente' AND cp.data_vencimento < CURRENT_DATE))`;
            } else if (status === 'pendente') {
                query += ` AND cp.status_pagamento = 'pendente' AND cp.data_vencimento >= CURRENT_DATE`;
            } else {
                query += ` AND cp.status_pagamento = $${paramIndex++}`;
                params.push(status);
            }
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
router.patch('/parcelas/:parcelaId', checkPermission('boletos', 'salvar'), async (req, res) => {
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

        const parcela = result.rows[0];

        // Build a friendly audit message
        let detalhe = `Parcela atualizada.`;
        if (status_pagamento === 'pago') {
            detalhe = `Parcela marcada como PAGA. Valor pago: ${valor_pago || '-'}. Data: ${data_pagamento || 'hoje'}.`;
        } else if (status_pagamento === 'cancelado') {
            detalhe = `Parcela cancelada.`;
        } else if (status_pagamento === 'pendente') {
            detalhe = `Status revertido para pendente.`;
        }

        logAudit(req, 'ATUALIZAR', 'PARCELA', req.params.parcelaId, null,
            { status_pagamento: parcela.status_pagamento, valor_pago: parcela.valor_pago, data_pagamento: parcela.data_pagamento },
            detalhe
        );

        res.json(parcela);
    } catch (err) {
        console.error('Update installment error:', err);
        res.status(500).json({ error: 'Erro ao atualizar parcela.' });
    }
});

// Delete installment (manually generated or otherwise)
router.delete('/parcelas/:id', checkPermission('boletos', 'deletar'), async (req, res) => {
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
        // NOTE: $1 and $3 both carry `status` to avoid PostgreSQL error 42P08
        // (inconsistent type inference when the same parameter appears in SET
        //  and in a CASE WHEN literal comparison simultaneously).
        await client.query(
            `UPDATE contrato_parcelas 
             SET status_pagamento = $1, 
                 updated_at = NOW(),
                 data_pagamento = CASE 
                    WHEN $3 = 'pago' THEN COALESCE(data_pagamento, CURRENT_DATE)
                    ELSE data_pagamento 
                 END
             WHERE id = ANY($2::uuid[])`,
            [status, ids, status]
        );

        await client.query('COMMIT');

        // Build a friendly audit message
        const statusLabel = {
            pago: 'PAGO',
            pendente: 'PENDENTE',
            cancelado: 'CANCELADO',
            atrasado: 'ATRASADO'
        }[status] || status.toUpperCase();

        let detalhe = `${ids.length} parcela(s) marcada(s) como ${statusLabel}.`;
        if (status === 'pago') {
            detalhe = `${ids.length} parcela(s) marcada(s) como PAGA. Data de pagamento registrada automaticamente.`;
        }

        logAudit(req, 'ATUALIZAR', 'PARCELA', null, null,
            { ids, status_novo: status },
            detalhe
        );

        res.json({ message: 'Parcelas atualizadas com sucesso.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('CRITICAL: Bulk update error:', err);
        res.status(500).json({ error: 'Erro ao atualizar parcelas.', details: err.message });
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

// Bulk Print Boletos (HTML) - Sync
router.get('/parcelas/bulk/boletos', async (req, res) => {
    try {
        const { ids } = req.query;
        if (!ids) return res.status(400).send('IDs são obrigatórios.');

        const idList = ids.split(',').filter(id => id && isValidUUID(id));

        if (idList.length === 0) return res.status(400).send('IDs inválidos.');

        // Fetch details for all selected installments
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
            WHERE cp.id = ANY($1::uuid[])
        `, [idList]);

        if (result.rows.length === 0) {
            return res.status(404).send('Nenhuma parcela encontrada.');
        }

        const Boleto = require('node-boleto').Boleto;

        // Render each boleto and combine HTML
        const renderPromises = result.rows.map(parcela => {
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
                'nosso_numero': parcela.numero_parcela ? `0000000${parcela.numero_parcela}` : '00000000001',
                'numero_documento': parcela.id.substring(0, 10),
                'cedente': 'Gestão Imóveis Ltda',
                'cedente_cnpj': '12.345.678/0001-90',
                'agencia': '1234',
                'codigo_cedente': '123456',
                'carteira': '102',
                'pagador': parcela.inquilino_nome,
                'local_de_pagamento': 'PAGÁVEL EM QUALQUER BANCO ATÉ O VENCIMENTO.',
                'instrucoes': [
                    'Sr. Caixa, aceitar o pagamento após o vencimento com juros de dia.',
                    `Referente a: ${parcela.descricao || 'Aluguel'}`
                ],
            });

            return new Promise((resolve) => {
                boleto.renderHTML((html) => resolve(html));
            });
        });

        const htmlResults = await Promise.all(renderPromises);

        // Combine into a master document
        let masterHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Impressão de Boletos em Massa</title>
                <style>
                    body { margin: 0; padding: 0; }
                    .print-page { 
                        page-break-after: always; 
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .print-page:last-child { page-break-after: avoid; }
                    /* Inject node-boleto internal styles if needed, but they are usually inline */
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                        .boleto-viewer { transform: scale(0.95); transform-origin: top center; }
                    }
                </style>
            </head>
            <body onload="window.print()">
        `;

        htmlResults.forEach(html => {
            // node-boleto returns a full document. Extract body content using simple match
            const bodyContent = html.match(/<body>([\s\S]*)<\/body>/i);
            const content = bodyContent ? bodyContent[1] : html;
            masterHtml += `<div class="print-page">${content}</div>`;
        });

        masterHtml += `</body></html>`;
        res.set('Content-Type', 'text/html');
        res.send(masterHtml);

    } catch (err) {
        console.error('Bulk generation error:', err);
        res.status(500).send('Erro ao gerar boletos em massa: ' + err.message);
    }
});

// Bulk Print Boletos (PDF) - 4 per page
router.get('/parcelas/bulk/pdf', async (req, res) => {
    try {
        const { ids } = req.query;
        if (!ids) return res.status(400).send('IDs são obrigatórios.');

        const idList = ids.split(',').filter(id => id && isValidUUID(id));
        if (idList.length === 0) return res.status(400).send('IDs inválidos.');

        const result = await pool.query(`
            SELECT cp.*, 
                c.id as contrato_id,
                i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf,
                p.endereco AS imovel_endereco, p.numero AS imovel_numero, p.cidade AS imovel_cidade,
                u.identificador AS unidade_identificador, u.tipo_unidade
            FROM contrato_parcelas cp
            LEFT JOIN contratos c ON cp.contrato_id = c.id
            LEFT JOIN inquilinos i ON cp.inquilino_id = i.id OR c.inquilino_id = i.id
            LEFT JOIN unidades u ON cp.unidade_id = u.id OR c.unidade_id = u.id
            LEFT JOIN propriedades p ON u.propriedade_id = p.id
            WHERE cp.id = ANY($1::uuid[])
            ORDER BY cp.data_vencimento ASC
        `, [idList]);

        if (result.rows.length === 0) return res.status(404).send('Nenhuma parcela encontrada.');

        const { generateBulkBoletosPDF } = require('../services/pdfService');
        const path = require('path');
        const fs = require('fs');

        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const fileName = `boletos_massa_${new Date().getTime()}.pdf`;
        const filePath = path.join(tempDir, fileName);

        await generateBulkBoletosPDF(result.rows, filePath);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${fileName}"`
        });
        res.sendFile(filePath, (err) => {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (err) console.error('Download error:', err);
        });

    } catch (err) {
        console.error('Bulk PDF error:', err);
        res.status(500).send('Erro ao gerar PDF em massa: ' + err.message);
    }
});

module.exports = router;
