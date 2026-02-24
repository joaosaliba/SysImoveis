const express = require('express');
const pool = require('../db/pool');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, checkPermission } = require('../middleware/auth');
const { getPaginationParams, formatPaginatedResponse } = require('../db/pagination');

const router = express.Router();
router.use(verifyToken);

// ===== MULTER CONFIG =====
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'documentos');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'image/jpeg', 'image/png', 'image/webp', 'image/gif',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Use PDF, imagens ou documentos Word.'));
        }
    }
});

// ===== INQUILINOS CRUD =====

// List all tenants (with optional search and pagination)
router.get('/', checkPermission('inquilinos', 'ver'), async (req, res) => {
    try {
        const { search, page, limit } = req.query;
        const { offset, limit: limitNum, page: pageNum } = getPaginationParams(page, limit);

        let whereClause = '';
        let params = [];

        if (search) {
            whereClause = ` WHERE nome_completo ILIKE $1 OR cpf ILIKE $1`;
            params = [`%${search}%`];
        }

        const countQuery = `SELECT COUNT(*) FROM inquilinos${whereClause}`;
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        const dataQuery = `SELECT * FROM inquilinos ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
        const dataParams = [...params, limitNum, offset];
        const result = await pool.query(dataQuery, dataParams);

        res.json(formatPaginatedResponse(result.rows, total, pageNum, limitNum));
    } catch (err) {
        console.error('List tenants error:', err);
        res.status(500).json({ error: 'Erro ao listar inquilinos.' });
    }
});

// Get single tenant
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inquilinos WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquilino não encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get tenant error:', err);
        res.status(500).json({ error: 'Erro ao buscar inquilino.' });
    }
});

// Create tenant
router.post('/', checkPermission('inquilinos', 'salvar'), async (req, res) => {
    try {
        const { cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones, email, observacoes, restricoes } = req.body;

        if (!cpf || !nome_completo) {
            return res.status(400).json({ error: 'CPF e nome completo são obrigatórios.' });
        }

        const existing = await pool.query('SELECT id FROM inquilinos WHERE cpf = $1', [cpf]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'CPF já cadastrado.' });
        }

        const result = await pool.query(
            `INSERT INTO inquilinos (cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones, email, observacoes, restricoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
            [cpf, nome_completo, rg, orgao_emissor, uf_rg, JSON.stringify(telefones || []), email, observacoes, restricoes]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Create tenant error:', err);
        res.status(500).json({ error: 'Erro ao criar inquilino.' });
    }
});

// Update tenant
router.put('/:id', checkPermission('inquilinos', 'salvar'), async (req, res) => {
    try {
        const { cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones, email, observacoes, restricoes } = req.body;

        const result = await pool.query(
            `UPDATE inquilinos SET
        cpf = COALESCE($1, cpf),
        nome_completo = COALESCE($2, nome_completo),
        rg = COALESCE($3, rg),
        orgao_emissor = COALESCE($4, orgao_emissor),
        uf_rg = COALESCE($5, uf_rg),
        telefones = COALESCE($6, telefones),
        email = COALESCE($7, email),
        observacoes = COALESCE($8, observacoes),
        restricoes = COALESCE($9, restricoes),
        updated_at = NOW()
       WHERE id = $10 RETURNING *`,
            [cpf, nome_completo, rg, orgao_emissor, uf_rg, telefones ? JSON.stringify(telefones) : null, email, observacoes, restricoes, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquilino não encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update tenant error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'CPF já cadastrado para outro inquilino.' });
        }
        res.status(500).json({ error: 'Erro ao atualizar inquilino.' });
    }
});

// Delete tenant
router.delete('/:id', checkPermission('inquilinos', 'deletar'), async (req, res) => {
    try {
        // Also delete files from disk
        const docs = await pool.query('SELECT nome_arquivo FROM inquilino_documentos WHERE inquilino_id = $1', [req.params.id]);
        for (const doc of docs.rows) {
            const filePath = path.join(UPLOAD_DIR, doc.nome_arquivo);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        const result = await pool.query('DELETE FROM inquilinos WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Inquilino não encontrado.' });
        }
        res.json({ message: 'Inquilino removido com sucesso.' });
    } catch (err) {
        console.error('Delete tenant error:', err);
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Inquilino possui contratos vinculados e não pode ser removido.' });
        }
        res.status(500).json({ error: 'Erro ao remover inquilino.' });
    }
});

// ===== DOCUMENT ROUTES =====

// Upload documents (up to 5 files at once)
router.post('/:id/documentos', checkPermission('inquilinos', 'salvar'), upload.array('arquivos', 5), async (req, res) => {
    try {
        // Verify tenant exists
        const tenant = await pool.query('SELECT id FROM inquilinos WHERE id = $1', [req.params.id]);
        if (tenant.rows.length === 0) {
            // Clean up uploaded files
            for (const f of req.files) {
                if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
            }
            return res.status(404).json({ error: 'Inquilino não encontrado.' });
        }

        const tipo = req.body.tipo || 'outro';
        const docs = [];

        for (const file of req.files) {
            const result = await pool.query(
                `INSERT INTO inquilino_documentos (inquilino_id, nome_original, nome_arquivo, tipo, mimetype, tamanho_bytes)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [req.params.id, file.originalname, file.filename, tipo, file.mimetype, file.size]
            );
            docs.push(result.rows[0]);
        }

        res.status(201).json(docs);
    } catch (err) {
        console.error('Upload document error:', err);
        res.status(500).json({ error: 'Erro ao fazer upload de documento.' });
    }
});

// List documents for a tenant
router.get('/:id/documentos', checkPermission('inquilinos', 'ver'), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM inquilino_documentos WHERE inquilino_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('List documents error:', err);
        res.status(500).json({ error: 'Erro ao listar documentos.' });
    }
});

// Download a document
router.get('/documentos/:docId/download', checkPermission('inquilinos', 'ver'), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM inquilino_documentos WHERE id = $1', [req.params.docId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Documento não encontrado.' });
        }

        const doc = result.rows[0];
        const filePath = path.join(UPLOAD_DIR, doc.nome_arquivo);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });
        }

        res.download(filePath, doc.nome_original);
    } catch (err) {
        console.error('Download document error:', err);
        res.status(500).json({ error: 'Erro ao baixar documento.' });
    }
});

// Delete a document
router.delete('/documentos/:docId', checkPermission('inquilinos', 'deletar'), async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM inquilino_documentos WHERE id = $1 RETURNING *', [req.params.docId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Documento não encontrado.' });
        }

        // Remove file from disk
        const filePath = path.join(UPLOAD_DIR, result.rows[0].nome_arquivo);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        res.json({ message: 'Documento removido com sucesso.' });
    } catch (err) {
        console.error('Delete document error:', err);
        res.status(500).json({ error: 'Erro ao remover documento.' });
    }
});

// Multer error handling middleware
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Arquivo excede o limite de 10MB.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ error: 'Máximo de 5 arquivos por upload.' });
        }
        return res.status(400).json({ error: err.message });
    }
    if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

module.exports = router;
