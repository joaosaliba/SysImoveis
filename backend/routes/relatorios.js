const express = require('express');
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { generateContratoPDF, generateBoletoPDF } = require('../services/pdfService');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(verifyToken);

// Gerar PDF do contrato
router.get('/contrato/:id', async (req, res) => {
    try {
        const contratoId = req.params.id;

        // Buscar dados do contrato
        const result = await pool.query(`
      SELECT c.*,
        i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf,
        u.identificador AS unidade_identificador, u.tipo_unidade,
        p.endereco AS imovel_endereco, p.numero AS imovel_numero, 
        p.cidade AS imovel_cidade, p.nome AS imovel_nome
      FROM contratos c
      JOIN inquilinos i ON c.inquilino_id = i.id
      JOIN unidades u ON c.unidade_id = u.id
      JOIN propriedades p ON u.propriedade_id = p.id
      WHERE c.id = $1
    `, [contratoId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Contrato não encontrado.' });
        }

        const contrato = result.rows[0];

        // Criar pasta temporária se não existir
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Gerar PDF
        const fileName = `contrato_${contratoId.slice(0, 8)}.pdf`;
        const filePath = path.join(tempDir, fileName);

        await generateContratoPDF(contrato, filePath);

        // Enviar arquivo
        res.download(filePath, fileName, (err) => {
            // Limpar arquivo após download
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            if (err) {
                console.error('Download error:', err);
            }
        });
    } catch (err) {
        console.error('Generate contract PDF error:', err);
        res.status(500).json({ error: 'Erro ao gerar PDF do contrato.' });
    }
});

// Gerar PDF do boleto/parcela
router.get('/boleto/:id', async (req, res) => {
    try {
        const parcelaId = req.params.id;

        // Buscar dados da parcela
        const result = await pool.query(`
      SELECT cp.*,
        i.nome_completo AS inquilino_nome, i.cpf AS inquilino_cpf,
        u.identificador AS unidade_identificador,
        p.endereco AS imovel_endereco, p.numero AS imovel_numero,
        p.cidade AS imovel_cidade, p.nome AS imovel_nome
      FROM contrato_parcelas cp
      LEFT JOIN contratos c ON cp.contrato_id = c.id
      LEFT JOIN inquilinos i ON cp.inquilino_id = i.id OR c.inquilino_id = i.id
      LEFT JOIN unidades u ON cp.unidade_id = u.id OR c.unidade_id = u.id
      LEFT JOIN propriedades p ON u.propriedade_id = p.id
      WHERE cp.id = $1
    `, [parcelaId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Parcela não encontrada.' });
        }

        const parcela = result.rows[0];

        // Criar pasta temporária se não existir
        const tempDir = path.join(__dirname, '..', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Gerar PDF
        const fileName = `boleto_${parcelaId.slice(0, 8)}.pdf`;
        const filePath = path.join(tempDir, fileName);

        await generateBoletoPDF(parcela, filePath);

        // Enviar arquivo
        res.download(filePath, fileName, (err) => {
            // Limpar arquivo após download
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            if (err) {
                console.error('Download error:', err);
            }
        });
    } catch (err) {
        console.error('Generate boleto PDF error:', err);
        res.status(500).json({ error: 'Erro ao gerar PDF do boleto.' });
    }
});

module.exports = router;
