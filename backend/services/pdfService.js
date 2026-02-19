const pdfkit = require('pdfkit');
const path = require('path');

/**
 * Gera PDF de contrato de locação
 * @param {Object} contrato - Dados do contrato
 * @param {String} outputPath - Caminho para salvar o PDF
 * @returns {Promise<string>} - Caminho do arquivo gerado
 */
function generateContratoPDF(contrato, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit({ margin: 50 });
            const stream = require('fs').createWriteStream(outputPath);
            doc.pipe(stream);

            // Header
            doc.fontSize(18).text('CONTRATO DE LOCAÇÃO RESIDENCIAL', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).text(`Contrato nº ${contrato.id.slice(0, 8).toUpperCase()}`, { align: 'center' });
            doc.moveDown(1);

            // Partes
            doc.fontSize(12).text('PARTES CONTRATANTES', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            doc.text(`LOCADOR: Sistema SysImóveis`);
            doc.text(`LOCATÁRIO: ${contrato.inquilino_nome}`);
            doc.text(`CPF: ${contrato.inquilino_cpf}`);
            doc.moveDown(0.5);

            // Imóvel
            doc.fontSize(12).text('OBJETO DO CONTRATO', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            doc.text(`Imóvel: ${contrato.imovel_nome || contrato.imovel_endereco}`);
            doc.text(`Endereço: ${contrato.imovel_endereco}${contrato.imovel_numero ? ', ' + contrato.imovel_numero : ''} - ${contrato.imovel_cidade}`);
            doc.text(`Unidade: ${contrato.unidade_identificador} (${contrato.tipo_unidade})`);
            doc.moveDown(0.5);

            // Vigência
            doc.fontSize(12).text('VIGÊNCIA', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            const dataInicio = new Date(contrato.data_inicio).toLocaleDateString('pt-BR');
            const dataFim = new Date(contrato.data_fim).toLocaleDateString('pt-BR');
            doc.text(`Início: ${dataInicio}`);
            doc.text(`Término: ${dataFim}`);
            doc.text(`Ocupantes: ${contrato.qtd_ocupantes}`);
            doc.moveDown(0.5);

            // Valores
            doc.fontSize(12).text('VALORES E CONDIÇÕES', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10);
            doc.text(`Aluguel: R$ ${contrato.valor_inicial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`IPTU: R$ ${contrato.valor_iptu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`Água: R$ ${contrato.valor_agua.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`Luz: R$ ${contrato.valor_luz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            doc.text(`Outros: R$ ${contrato.valor_outros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            const total = contrato.valor_inicial + contrato.valor_iptu + contrato.valor_agua + contrato.valor_luz + contrato.valor_outros;
            doc.text(`TOTAL MENSAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { bold: true });
            doc.text(`Dia de vencimento: ${contrato.dia_vencimento}º dia de cada mês`);
            doc.moveDown(0.5);

            // Observações
            if (contrato.observacoes_contrato) {
                doc.fontSize(12).text('OBSERVAÇÕES', { underline: true });
                doc.moveDown(0.5);
                doc.fontSize(10);
                doc.text(contrato.observacoes_contrato);
                doc.moveDown(0.5);
            }

            // Footer
            doc.moveDown(2);
            doc.fontSize(9);
            doc.text('_________________________________________', { align: 'center' });
            doc.text('Assinatura do Locador', { align: 'center' });
            doc.moveDown(1);
            doc.text('_________________________________________', { align: 'center' });
            doc.text('Assinatura do Locatário', { align: 'center' });
            doc.moveDown(1);
            doc.fontSize(8);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

            doc.end();

            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Gera PDF de boleto/parcela
 * @param {Object} parcela - Dados da parcela
 * @param {String} outputPath - Caminho para salvar o PDF
 * @returns {Promise<string>} - Caminho do arquivo gerado
 */
function generateBoletoPDF(parcela, outputPath) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new pdfkit({ margin: 50 });
            const stream = require('fs').createWriteStream(outputPath);
            doc.pipe(stream);

            // Header
            doc.fontSize(16).text('BOLETO DE ALUGUEL', { align: 'center' });
            doc.moveDown(0.5);

            // Dados do inquilino
            doc.fontSize(11).text('LOCATÁRIO', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10);
            doc.text(`Nome: ${parcela.inquilino_nome}`);
            doc.text(`CPF: ${parcela.inquilino_cpf}`);
            doc.moveDown(0.5);

            // Imóvel
            doc.fontSize(11).text('IMÓVEL', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10);
            doc.text(`${parcela.imovel_nome || parcela.imovel_endereco}`);
            doc.text(`${parcela.imovel_endereco}${parcela.imovel_numero ? ', ' + parcela.imovel_numero : ''} - ${parcela.imovel_cidade}`);
            doc.text(`Unidade: ${parcela.unidade_identificador}`);
            doc.moveDown(0.5);

            // Dados da parcela
            doc.fontSize(11).text('DADOS DO PAGAMENTO', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(10);
            doc.text(`Descrição: ${parcela.descricao || 'Aluguel'}`);
            const vencimento = new Date(parcela.data_vencimento).toLocaleDateString('pt-BR');
            doc.text(`Vencimento: ${vencimento}`);
            doc.text(`Status: ${parcela.status_pagamento.toUpperCase()}`);
            doc.moveDown(0.5);

            // Valores
            const total = parcela.valor_base + parcela.valor_iptu + parcela.valor_agua + parcela.valor_luz + parcela.valor_outros - parcela.desconto_pontualidade;
            
            doc.fontSize(10);
            doc.text(`Aluguel: R$ ${parcela.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_iptu > 0) doc.text(`IPTU: R$ ${parcela.valor_iptu.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_agua > 0) doc.text(`Água: R$ ${parcela.valor_agua.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_luz > 0) doc.text(`Luz: R$ ${parcela.valor_luz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.valor_outros > 0) doc.text(`Outros: R$ ${parcela.valor_outros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
            if (parcela.desconto_pontualidade > 0) doc.text(`Desconto: -R$ ${parcela.desconto_pontualidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { color: '#22c55e' });
            
            doc.moveDown(0.5);
            doc.fontSize(14).text(`TOTAL: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, { bold: true, underline: true });

            // Footer
            doc.moveDown(2);
            doc.fontSize(8);
            doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
            doc.text('Este não é um documento oficial de cobrança.', { align: 'center' });

            doc.end();

            stream.on('finish', () => resolve(outputPath));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    generateContratoPDF,
    generateBoletoPDF,
};
